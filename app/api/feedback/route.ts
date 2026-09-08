// app/api/feedback/route.ts
// POST /api/feedback { category, message, contact_email? }
//
// In-app feedback intake (components/FeedbackWidget.tsx FeedbackModal,
// triggered from the Sidebar account block). Inserts a row into
// public.feedback (migration 0014) and emails the support inbox via Brevo,
// same dry-run-safe pattern as the deadline cron: missing BREVO_API_KEY /
// REMINDER_FROM_EMAIL logs and skips the email instead of failing the
// request, so feedback is never lost because email isn't configured yet.
//
// Rate limited 5/hour per user on top of the IP bucket -- feedback is a
// low-volume, high-intent action, so the cap is generous for humans and
// still a brake on scripts.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { logError, logWarn } from '@/lib/logging'

const ROUTE = '/api/feedback'
const SUPPORT_INBOX = 'support.scholarsteam@gmail.com'

const bodySchema = z.object({
  category: z.enum(['bug', 'feature', 'scholarship', 'other']),
  message: z.string().trim().min(10, 'Please write at least 10 characters.').max(2000),
  contact_email: z.string().email().nullish(),
})

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Something is broken',
  feature: 'Feature request',
  scholarship: 'Scholarship issue',
  other: 'Other',
}

async function sendFeedbackEmail(params: {
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
  const escaped = params.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholars feedback' },
      to: [{ email: SUPPORT_INBOX }],
      replyTo: params.contactEmail ? { email: params.contactEmail } : undefined,
      subject: `[Scholars feedback] ${CATEGORY_LABELS[params.category] ?? params.category}`,
      htmlContent: `
<p><strong>Category:</strong> ${CATEGORY_LABELS[params.category] ?? params.category}</p>
${params.contactEmail ? `<p><strong>Reply to:</strong> ${params.contactEmail}</p>` : ''}
${params.pageUrl ? `<p><strong>From page:</strong> ${params.pageUrl}</p>` : ''}
<p><strong>Message:</strong></p>
<p style="white-space:pre-wrap">${escaped}</p>
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
  const limited = await checkRateLimit(request, {
    route: 'feedback',
    limit: 5,
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

  const pageUrl = request.headers.get('referer')
  const { error: insertError } = await supabase.from('feedback').insert({
    profile_id: user.id,
    category: parsed.data.category,
    message: parsed.data.message,
    contact_email: parsed.data.contact_email ?? null,
    page_url: pageUrl,
  })
  if (insertError) {
    logError(ROUTE, 'insert_failed', undefined, insertError)
    // 42501 = RLS denied the insert. In practice this means the feedback
    // policies from migration 0014 are missing in this database (partial
    // run, or run against a different project). Show a plain sentence
    // instead of leaking raw Postgres text to a student.
    const friendly =
      insertError.code === '42501'
        ? "We couldn't save your feedback yet because our database permissions are still being set up. Please try again shortly, or email support.scholarsteam@gmail.com directly."
        : insertError.message
    return NextResponse.json({ error: friendly }, { status: 500 })
  }

  try {
    await sendFeedbackEmail({
      category: parsed.data.category,
      message: parsed.data.message,
      contactEmail: parsed.data.contact_email ?? null,
      pageUrl,
    })
  } catch (err) {
    // Row is already stored, so triage can still happen from the database.
    logError(ROUTE, 'email_failed', undefined, err)
  }

  // Client (FeedbackModal) only checks res.ok, never reads the body, so
  // we don't need to return the inserted row's id. Keeping the response
  // minimal also avoids the TS strict-null complaint on data?.id when
  // .insert() isn't chained with .select().
  return NextResponse.json({ ok: true }, { status: 201 })
}
