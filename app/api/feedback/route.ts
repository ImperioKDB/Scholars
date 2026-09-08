// app/api/feedback/route.ts
// POST /api/feedback  { category, message, contact_email? }
//
// In-app feedback intake. Inserts a row into the public.feedback table
// (migration 0014) and, when Brevo is configured, emails the message to
// support.scholarsteam@gmail.com. Dry-run-safe the same way the deadline
// cron is: missing BREVO_API_KEY / REMINDER_FROM_EMAIL logs but doesn't
// fail the request, so a student's feedback is never silently lost just
// because the email backend isn't wired up yet.
//
// Rate limit: 3 submissions per hour per user. Generous for legitimate
// reports (a student may file one bug, one idea, and one scholarship issue
// in the same sitting) but a hard brake on inbox spam.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { logError, logWarn } from '@/lib/logging'

const ROUTE = '/api/feedback'
const SUPPORT_INBOX = 'support.scholarsteam@gmail.com'

const bodySchema = z.object({
  category: z.enum(['bug', 'feature', 'scholarship', 'other']),
  message: z.string().trim().min(10).max(5000),
  contact_email: z.string().email().nullable().optional(),
})

async function emailFeedback(params: {
  to: string
  category: string
  message: string
  contactEmail: string | null
  pageUrl: string | null
}) {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) {
    logWarn(ROUTE, 'email_skipped_dry_run', { category: params.category })
    return
  }
  const categoryLabel =
    params.category === 'bug'
      ? 'Bug report'
      : params.category === 'feature'
        ? 'Feature request'
        : params.category === 'scholarship'
          ? 'Scholarship issue'
          : 'Other feedback'
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholars feedback' },
      to: [{ email: params.to }],
      replyTo: params.contactEmail ? { email: params.contactEmail } : undefined,
      subject: `[Scholars feedback] ${categoryLabel}`,
      htmlContent: `
<p><strong>Category:</strong> ${categoryLabel}</p>
${params.contactEmail ? `<p><strong>Reply to:</strong> ${params.contactEmail}</p>` : ''}
${params.pageUrl ? `<p><strong>From page:</strong> ${params.pageUrl}</p>` : ''}
<p><strong>Message:</strong></p>
<p style="white-space:pre-wrap">${params.message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>
`,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  // 3/hour per user -- generous for real reports, a brake on spam.
  const limited = await checkRateLimit(request, {
    route: 'feedback',
    limit: 3,
    extraKeys: [`user:${user.id}`],
  })
  if (limited) return limited

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid feedback', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const pageUrl = request.headers.get('referer') ?? null
  const { data, error: insertError } = await supabase
    .from('feedback')
    .insert({
      profile_id: user.id,
      category: parsed.data.category,
      message: parsed.data.message,
      contact_email: parsed.data.contact_email ?? null,
      page_url: pageUrl,
    })
    .select('id')
    .single()
  if (insertError) {
    logError(ROUTE, 'insert_failed', undefined, insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  try {
    await emailFeedback({
      to: SUPPORT_INBOX,
      category: parsed.data.category,
      message: parsed.data.message,
      contactEmail: parsed.data.contact_email ?? null,
      pageUrl,
    })
  } catch (err) {
    // Email failure is logged but never fails the request -- the row is
    // already in the DB, so triage can still happen via Supabase.
    logError(ROUTE, 'email_failed', { feedback_id: data.id }, err)
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
