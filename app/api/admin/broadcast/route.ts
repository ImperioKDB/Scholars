// app/api/admin/broadcast/route.ts
// GET  /api/admin/broadcast -- { recipientCount } so the admin page can say
//      exactly how many emails a broadcast will send before you commit.
// POST /api/admin/broadcast { scholarship_ids } -- send ONE personalized
//      email per registered user containing every selected scholarship as
//      tiles. Admin-only (middleware /api/admin gate + assertAdmin here),
//      rate limited 3/min so a stuck button can't fan out sends.
//
// Recipients = EVERY registered auth email (service-role listUsers), not
// just profiles: a student who signed up but never finished onboarding is
// still a registered student and should hear about hand-picked awards.
// Personalization uses the signup full_name when present, else the email
// local part. announcement_log is written (ignoreDuplicates) only for
// recipients who have a profile row (FK constraint), so the automatic
// digest won't re-send the same listings later.
//
// Only verified scholarships can be broadcast: an unverified listing has no
// public page for the email to link to.
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
const bodySchema = z.object({
  scholarship_ids: z.array(z.string().uuid()).min(1).max(10),
})

function baseUrlOf(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
}

async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) {
    throw new Error('Missing BREVO_API_KEY or REMINDER_FROM_EMAIL env vars')
  }
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
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
  }
}

async function listRecipients(service: ReturnType<typeof createServiceClient>) {
  const recipients: { id: string; email: string; fullName: string | null }[] = []
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't count recipients" },
      { status: 500 }
    )
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
      { error: 'Pick at least one scholarship (max 10 per broadcast).', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const service = createServiceClient()
  const { data: scholarships, error: schError } = await service
    .from('scholarships')
    .select('id, title, provider_name, amount, deadline')
    .eq('verified', true)
    .in('id', parsed.data.scholarship_ids)
  if (schError) {
    return NextResponse.json({ error: schError.message }, { status: 500 })
  }
  const rows = scholarships ?? []
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'None of the selected scholarships are verified, so there is nothing to link to.' },
      { status: 400 }
    )
  }

  const baseUrl = baseUrlOf()
  const items: EmailListing[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    provider_name: r.provider_name,
    amount: r.amount,
    deadline: r.deadline,
    kind_label: 'Scholarship',
    url: `${baseUrl}/scholarships/${r.id}`,
  }))

  let recipients: { id: string; email: string; fullName: string | null }[]
  try {
    recipients = await listRecipients(service)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load recipients" },
      { status: 500 }
    )
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No registered emails found.' }, { status: 400 })
  }

  // Profile ids only, for announcement_log dedupe (FK needs a profile row).
  const { data: profileRows } = await service.from('profiles').select('id')
  const profileIds = new Set((profileRows ?? []).map((p) => p.id as string))

  let sent = 0
  let failed = 0
  for (const r of recipients) {
    const firstName = r.fullName?.trim().split(/\s+/)[0] || r.email.split('@')[0]
    const { subject, html, text } = renderBroadcastDigest({ firstName, items, baseUrl })
    try {
      await sendEmail({ to: r.email, subject, html, text })
      sent++
      if (profileIds.has(r.id)) {
        await service
          .from('announcement_log')
          .insert(
            items.map((i) => ({
              profile_id: r.id,
              listing_kind: 'scholarship',
              listing_id: i.id,
            }))
          , { ignoreDuplicates: true })
      }
    } catch (err) {
      failed++
      logError(ROUTE, 'send_failed', { email: r.email }, err)
    }
  }
  logWarn(ROUTE, 'broadcast_complete', {
    sent,
    failed,
    recipients: recipients.length,
    scholarships: items.length,
  })
  return NextResponse.json({
    sent,
    failed,
    recipients: recipients.length,
    scholarships: items.length,
  })
}
