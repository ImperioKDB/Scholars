// app/api/admin/broadcast/route.ts
// GET  /api/admin/broadcast -- { recipientCount }
// POST /api/admin/broadcast { scholarship_ids?, opportunity_ids? }
// Sends one personalized email per registered user and records every delivery
// attempt so partial sends are visible and retryable.
import { dbErrorResponse } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertAdmin } from '@/lib/admin/guard'
import { checkRateLimit } from '@/lib/ratelimit'
import { logError, logWarn } from '@/lib/logging'
import { renderBroadcastDigest, type EmailListing } from '@/lib/email/template'

export const maxDuration = 300

const ROUTE = '/api/admin/broadcast'
const MAX_ATTEMPTS = 3
const SEND_CONCURRENCY = 5
const bodySchema = z.object({
  scholarship_ids: z.array(z.string().uuid()).optional().default([]),
  opportunity_ids: z.array(z.string().uuid()).optional().default([]),
}).refine(
  (obj) => obj.scholarship_ids.length > 0 || obj.opportunity_ids.length > 0,
  'Pick at least one scholarship or opportunity (max 10 total per broadcast).'
).refine(
  (obj) => obj.scholarship_ids.length + obj.opportunity_ids.length <= 10,
  'Max 10 listings per broadcast.'
)

type Recipient = { id: string; email: string; fullName: string | null }
type SendOutcome = { messageId: string | null; attempts: number }

function baseUrlOf(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
}

const KIND_LABELS: Record<string, string> = {
  fellowship: 'Fellowship',
  internship: 'Internship',
  competition: 'Competition',
  mentorship: 'Mentorship',
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendOutcome> {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) {
    throw new Error('Missing BREVO_API_KEY or REMINDER_FROM_EMAIL env vars')
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: from, name: 'Scholars' },
          to: [{ email: params.to }],
          subject: params.subject,
          htmlContent: params.html,
          textContent: params.text,
        }),
      })
      const body = await resp.text().catch(() => '')
      if (!resp.ok) {
        throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
      }
      let messageId: string | null = null
      try {
        const parsed = JSON.parse(body) as { messageId?: string }
        messageId = parsed.messageId ?? null
      } catch {
        // Brevo may return an empty body; the successful HTTP response is enough.
      }
      return { messageId, attempts: attempt }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_ATTEMPTS) await sleep(250 * 2 ** (attempt - 1))
    }
  }
  throw lastError ?? new Error('Email delivery failed')
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
    const recipients = await listRecipients(createServiceClient())
    return NextResponse.json({ recipientCount: recipients.length })
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

  let recipients: Recipient[]
  try {
    recipients = await listRecipients(service)
  } catch {
    return NextResponse.json({ error: "Couldn't load recipients" }, { status: 500 })
  }
  if (recipients.length === 0) return NextResponse.json({ error: 'No registered emails found.' }, { status: 400 })

  const { data: profileRows } = await service.from('profiles').select('id')
  const profileIds = new Set((profileRows ?? []).map((p) => p.id as string))
  const broadcastId = crypto.randomUUID()
  let sent = 0
  let failed = 0
  let attempted = 0

  async function processRecipient(r: Recipient) {
    const firstName = r.fullName?.trim().split(/\s+/)[0] || r.email.split('@')[0]
    const { subject, html, text } = renderBroadcastDigest({ firstName, items, baseUrl })
    try {
      const outcome = await sendEmail({ to: r.email, subject, html, text })
      sent++
      if (profileIds.has(r.id)) {
        const logInsert = [
          ...input.scholarship_ids.map((id) => ({ profile_id: r.id, listing_kind: 'scholarship', listing_id: id })),
          ...input.opportunity_ids.map((id) => ({ profile_id: r.id, listing_kind: 'opportunity', listing_id: id })),
        ]
        const { error: announcementError } = await service
          .from('announcement_log')
          .upsert(logInsert, { onConflict: 'profile_id,listing_kind,listing_id', ignoreDuplicates: true })
        if (announcementError) logWarn(ROUTE, 'announcement_log_failed', { email: r.email, error: announcementError.message })
      }
      await service.from('broadcast_delivery_log').insert({
        broadcast_id: broadcastId, recipient_email: r.email, recipient_user_id: r.id,
        status: 'sent', attempts: outcome.attempts, provider_message: outcome.messageId,
      })
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      logError(ROUTE, 'send_failed', { email: r.email, broadcast_id: broadcastId }, err)
      await service.from('broadcast_delivery_log').insert({
        broadcast_id: broadcastId, recipient_email: r.email, recipient_user_id: r.id,
        status: 'failed', attempts: MAX_ATTEMPTS, error_message: message,
      })
    } finally {
      attempted++
    }
  }

  let nextIndex = 0
  async function worker() {
    for (;;) {
      const index = nextIndex++
      if (index >= recipients.length) return
      await processRecipient(recipients[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, recipients.length) }, () => worker()))

  logWarn(ROUTE, 'broadcast_complete', {
    broadcast_id: broadcastId, sent, failed, attempted, recipients: recipients.length, listings: items.length,
  })
  return NextResponse.json({ broadcast_id: broadcastId, sent, failed, attempted, recipients: recipients.length, listings: items.length })
}
