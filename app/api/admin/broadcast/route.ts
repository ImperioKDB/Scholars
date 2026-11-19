// app/api/admin/broadcast/route.ts
// GET  /api/admin/broadcast -- { recipientCount, pushRecipientCount }
// POST /api/admin/broadcast { scholarship_ids?, opportunity_ids?, broadcast_id? }
// Sends one email per registered user and one push per opted-in profile,
// recording email attempts and idempotent push delivery outcomes separately.
import { dbErrorResponse } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { logError, logWarn } from '@/lib/logging'
import { sendEmail as sendTransactionalEmail } from '@/lib/email/send'
import { safeEmailErrorDiagnostic } from '@/lib/email/providers/types'
import { renderBroadcastDigest, type EmailListing } from '@/lib/email/template'
import { listEnabledPushProfileIds, sendAdminBroadcastPush } from '@/lib/push/adminBroadcast'
import { buildListingBroadcastPushMessage } from '@/lib/push/broadcastContent'
import { selectEmailBatch, type EmailBatch } from '@/lib/email/batches'

export const maxDuration = 300

const ROUTE = '/api/admin/broadcast'
const SEND_CONCURRENCY = 5
const bodySchema = z.object({
  scholarship_ids: z.array(z.string().uuid()).optional().default([]),
  opportunity_ids: z.array(z.string().uuid()).optional().default([]),
  broadcast_id: z.string().uuid().optional(),
  batch: z.enum(['A', 'B', 'C']).optional(),
}).refine(
  (obj) => obj.scholarship_ids.length > 0 || obj.opportunity_ids.length > 0,
  'Pick at least one scholarship or opportunity (max 10 total per broadcast).'
).refine(
  (obj) => obj.scholarship_ids.length + obj.opportunity_ids.length <= 10,
  'Max 10 listings per broadcast.'
)

type Recipient = { id: string; email: string; fullName: string | null }
type SendOutcome = { messageId: string | null; attempts: number; provider?: string }

function baseUrlOf(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.scholars.com.ng'
}

const KIND_LABELS: Record<string, string> = {
  fellowship: 'Fellowship',
  internship: 'Internship',
  competition: 'Competition',
  mentorship: 'Mentorship',
}

async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}): Promise<SendOutcome> {
  const result = await sendTransactionalEmail({ ...params, manual: true })
  if (result.dry) throw new Error('Email sending is not configured on the server.')
  return { messageId: result.messageId ?? null, attempts: 1, provider: result.provider }
}

async function listRecipients(service: ReturnType<typeof createServiceClient>): Promise<Recipient[]> {
  const recipients: Recipient[] = []
  let page = 1
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []
    for (const u of users) {
      if (u.email) {
        recipients.push({
          id: u.id,
          email: u.email,
          fullName: (u.user_metadata?.full_name as string | undefined) ?? null,
        })
      }
    }
    if (users.length < 100) break
    page++
  }
  return recipients
}

export async function GET() {
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response
  try {
    const service = createServiceClient()
    const [recipients, pushProfileIds] = await Promise.all([
      listRecipients(service),
      listEnabledPushProfileIds(service),
    ])
    return NextResponse.json({ recipientCount: recipients.length, pushRecipientCount: pushProfileIds.length })
  } catch {
    return NextResponse.json({ error: "Couldn't count recipients" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: 'admin-broadcast', limit: 3 })
  if (limited) return limited
  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Pick at least one scholarship or opportunity (max 10 total per broadcast).', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const input = parsed.data
  const broadcastId = input.broadcast_id ?? crypto.randomUUID()

  const service = createServiceClient()
  const baseUrl = baseUrlOf()
  const items: EmailListing[] = []

  if (input.scholarship_ids.length > 0) {
    const { data: scholarships, error: schError } = await service
      .from('scholarships')
      .select('id, slug, title, provider_name, amount, deadline')
      .eq('verified', true)
      .in('id', input.scholarship_ids)
    if (schError) return dbErrorResponse('admin/broadcast', schError)
    for (const r of scholarships ?? []) {
      items.push({ id: r.id, title: r.title, provider_name: r.provider_name, amount: r.amount,
        deadline: r.deadline, kind_label: 'Scholarship', url: `${baseUrl}/scholarship/${r.slug}` })
    }
  }

  if (input.opportunity_ids.length > 0) {
    const { data: opportunities, error: oppError } = await service
      .from('opportunities')
      .select('id, slug, type, title, provider_name, compensation, deadline')
      .eq('verified', true)
      .in('id', input.opportunity_ids)
    if (oppError) return dbErrorResponse('admin/broadcast', oppError)
    for (const r of opportunities ?? []) {
      items.push({ id: r.id, title: r.title, provider_name: r.provider_name, amount: r.compensation,
        deadline: r.deadline, kind_label: KIND_LABELS[r.type] ?? 'Opportunity', url: `${baseUrl}/opportunity/${r.slug}` })
    }
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'None of the selected listings are verified, so there is nothing to link to.' }, { status: 400 })
  }

  const broadcastOrder = new Map<string, number>()
  input.scholarship_ids.forEach((id, index) => broadcastOrder.set(`scholarship:${id}`, index))
  input.opportunity_ids.forEach((id, index) => broadcastOrder.set(`opportunity:${id}`, input.scholarship_ids.length + index))
  const orderedPushItems = [...items].sort((a, b) => {
    const orderFor = (item: EmailListing) => broadcastOrder.get(`${item.kind_label === 'Scholarship' ? 'scholarship' : 'opportunity'}:${item.id}`) ?? Number.MAX_SAFE_INTEGER
    return orderFor(a) - orderFor(b)
  })

  let recipients: Recipient[]
  let pushProfileIds: string[]
  try {
    [recipients, pushProfileIds] = await Promise.all([
      listRecipients(service),
      listEnabledPushProfileIds(service),
    ])
  } catch {
    return NextResponse.json({ error: "Couldn't load recipients" }, { status: 500 })
  }
  recipients = selectEmailBatch(recipients.sort((a, b) => a.id.localeCompare(b.id)), input.batch as EmailBatch | undefined)
  if (recipients.length === 0) return NextResponse.json({ error: 'This batch has no registered email recipients.' }, { status: 400 })
  if (input.batch) {
    const batchIds = new Set(recipients.map((recipient) => recipient.id))
    pushProfileIds = pushProfileIds.filter((profileId) => batchIds.has(profileId))
  }

  const { data: profileRows } = await service.from('profiles').select('id')
  const profileIds = new Set((profileRows ?? []).map((p) => p.id as string))
  let sent = 0
  let failed = 0
  let attempted = 0

  async function processRecipient(r: Recipient) {
    const firstName = r.fullName?.trim().split(/\s+/)[0] || r.email.split('@')[0]
    const { subject, html, text } = renderBroadcastDigest({ firstName, items, baseUrl })
    let outcome: SendOutcome
    try {
      outcome = await sendEmail({ to: r.email, subject, html, text, idempotencyKey: `broadcast/${broadcastId}/${r.id}` })
    } catch (err) {
      failed++
      const diagnostic = safeEmailErrorDiagnostic(err)
      const message = `${diagnostic.provider}:${diagnostic.classification}:${diagnostic.status ?? 'no_status'}:${diagnostic.code ?? 'unknown'}`
      logError(ROUTE, 'send_failed', { broadcast_id: broadcastId, recipient_user_id: r.id, ...diagnostic })
      await service.from('broadcast_delivery_log').insert({
        broadcast_id: broadcastId, recipient_email: r.email, recipient_user_id: r.id,
        status: 'failed', attempts: 1, error_message: message,
      })
      attempted++
      return
    }
    sent++
    if (profileIds.has(r.id)) {
      const logInsert = [
        ...input.scholarship_ids.map((id) => ({ profile_id: r.id, listing_kind: 'scholarship', listing_id: id })),
        ...input.opportunity_ids.map((id) => ({ profile_id: r.id, listing_kind: 'opportunity', listing_id: id })),
      ]
      const { error: announcementError } = await service
        .from('announcement_log')
        .upsert(logInsert, { onConflict: 'profile_id,listing_kind,listing_id', ignoreDuplicates: true })
      if (announcementError) logWarn(ROUTE, 'announcement_log_failed', { broadcast_id: broadcastId, error: announcementError.message })
    }
    const { error: logErrorResult } = await service.from('broadcast_delivery_log').insert({
      broadcast_id: broadcastId, recipient_email: r.email, recipient_user_id: r.id,
      status: 'sent', attempts: outcome.attempts, provider_message: outcome.messageId,
    })
    if (logErrorResult) logError(ROUTE, 'sent_delivery_log_failed', { broadcast_id: broadcastId, recipient_user_id: r.id }, logErrorResult)
    attempted++
  }

  let nextIndex = 0
  async function worker() {
    for (;;) {
      const index = nextIndex++
      if (index >= recipients.length) return
      await processRecipient(recipients[index])
    }
  }

  const pushMessage = buildListingBroadcastPushMessage(orderedPushItems)

  const emailWork = Promise.all(
    Array.from({ length: Math.min(SEND_CONCURRENCY, recipients.length) }, () => worker()),
  )
  const [pushSummary] = await Promise.all([
    sendAdminBroadcastPush(service, pushProfileIds, broadcastId, pushMessage),
    emailWork,
  ])

  logWarn(ROUTE, 'broadcast_complete', {
    broadcast_id: broadcastId, sent, failed, attempted, recipients: recipients.length, listings: items.length,
    push_recipients: pushSummary.recipients, push_accepted_profiles: pushSummary.acceptedProfiles,
    push_failed_profiles: pushSummary.failedProfiles, push_suppressed_profiles: pushSummary.suppressedProfiles,
  })
  return NextResponse.json({
    broadcast_id: broadcastId,
    sent,
    failed,
    attempted,
    recipients: recipients.length,
    listings: items.length,
    push: pushSummary,
  })
}
