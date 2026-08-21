// app/api/cron/deadline-check/route.ts
// GET /api/cron/deadline-check
//
// Triggered daily by Vercel Cron (see vercel.json). For every saved
// scholarship whose deadline falls within DEADLINE_REMINDER_DAYS from
// today, sends one reminder email and records it in `notifications` —
// checking that table first so the same (profile, scholarship) pair
// never gets reminded twice, no matter how many days in a row the
// deadline stays inside the window.
//
// AUTH: protected by CRON_SECRET, not by user session (there is no user
// session in a cron trigger). Vercel automatically sends
// `Authorization: Bearer ${CRON_SECRET}` on requests it makes to configured
// cron paths — see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
// Set CRON_SECRET in Vercel's env vars (not committed) alongside the other
// secrets in 05_CODING_WORKFLOW.md's env var list.
//
// EMAIL PROVIDER: Brevo (formerly Sendinblue), not Resend — 300 emails/day
// free forever, no card required, and no domain verification needed to
// start sending from their default sender while testing. Verify a domain
// later for production deliverability/reputation.
//
// ENV VARS NEEDED (new, not in the original 05_CODING_WORKFLOW.md list):
//   CRON_SECRET            — random string, also set in Vercel's Cron settings
//   BREVO_API_KEY          — from app.brevo.com/settings/keys/api, "email provider API key" in the doc's list
//   REMINDER_FROM_EMAIL    — sender address (verified domain recommended for production)
//   DEADLINE_REMINDER_DAYS — optional, defaults to 7 if unset

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const DEFAULT_REMINDER_DAYS = 7

interface SavedRow {
  profile_id: string
  scholarship_id: string
  scholarships: {
    id: string
    title: string
    provider_name: string
    deadline: string
    application_url: string | null
  } | null
}

async function sendReminderEmail(params: {
  to: string
  title: string
  provider: string
  deadline: string
  applicationUrl: string | null
}) {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL

  if (!apiKey || !from) {
    throw new Error('Missing BREVO_API_KEY or REMINDER_FROM_EMAIL env vars')
  }

  const deadlineFormatted = new Date(params.deadline).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholarship Platform' },
      to: [{ email: params.to }],
      subject: `Deadline coming up: ${params.title}`,
      htmlContent: `
        <p>Hi,</p>
        <p>A scholarship you saved is due soon:</p>
        <p>
          <strong>${params.title}</strong><br/>
          ${params.provider}<br/>
          Deadline: <strong>${deadlineFormatted}</strong>
        </p>
        ${
          params.applicationUrl
            ? `<p><a href="${params.applicationUrl}">Go to application</a></p>`
            : ''
        }
        <p>— Scholarship Platform</p>
      `,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reminderDays = Number(process.env.DEADLINE_REMINDER_DAYS) || DEFAULT_REMINDER_DAYS

  const supabase = createServiceClient()

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const cutoff = new Date(today)
  cutoff.setUTCDate(cutoff.getUTCDate() + reminderDays)

  const todayStr = today.toISOString().slice(0, 10)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Every saved scholarship whose deadline falls within the reminder window.
  // NOTE: `scholarships!inner(...)` is required here, not just
  // `scholarships(...)` — without the !inner hint, PostgREST performs a
  // LEFT JOIN and the .gte/.lte filters below only null out the embedded
  // object on a mismatch rather than dropping the parent row, so unrelated
  // saved_scholarships rows would still come back.
  const { data: saved, error: savedError } = await supabase
    .from('saved_scholarships')
    .select(
      `profile_id, scholarship_id,
       scholarships!inner ( id, title, provider_name, deadline, application_url )`
    )
    .gte('scholarships.deadline', todayStr)
    .lte('scholarships.deadline', cutoffStr)

  if (savedError) {
    return NextResponse.json({ error: savedError.message }, { status: 500 })
  }

  const candidates = ((saved ?? []) as unknown as SavedRow[]).filter(
    (row) => row.scholarships !== null
  )

  if (candidates.length === 0) {
    return NextResponse.json({ message: 'No upcoming deadlines in window', reminders_sent: 0 })
  }

  // Dedupe: skip any (profile_id, scholarship_id) pair that already has a
  // deadline_reminder notification, so a scholarship inside the window on
  // multiple consecutive cron runs only reminds once.
  const { data: existing, error: existingError } = await supabase
    .from('notifications')
    .select('profile_id, scholarship_id')
    .eq('type', 'deadline_reminder')
    .in(
      'scholarship_id',
      candidates.map((c) => c.scholarship_id)
    )

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const alreadyNotified = new Set(
    (existing ?? []).map((n) => `${n.profile_id}:${n.scholarship_id}`)
  )

  const toNotify = candidates.filter(
    (c) => !alreadyNotified.has(`${c.profile_id}:${c.scholarship_id}`)
  )

  if (toNotify.length === 0) {
    return NextResponse.json({ message: 'All upcoming deadlines already notified', reminders_sent: 0 })
  }

  // Cache user emails so a profile with multiple upcoming deadlines doesn't
  // trigger a repeat auth admin lookup.
  const emailCache = new Map<string, string | null>()

  const results = { sent: 0, failed: [] as { scholarship_id: string; profile_id: string; error: string }[] }

  for (const row of toNotify) {
    const scholarship = row.scholarships!

    let email = emailCache.get(row.profile_id)
    if (email === undefined) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        row.profile_id
      )
      email = userError ? null : userData.user?.email ?? null
      emailCache.set(row.profile_id, email)
    }

    if (!email) {
      results.failed.push({
        scholarship_id: row.scholarship_id,
        profile_id: row.profile_id,
        error: 'No email on file for user',
      })
      continue
    }

    try {
      await sendReminderEmail({
        to: email,
        title: scholarship.title,
        provider: scholarship.provider_name,
        deadline: scholarship.deadline,
        applicationUrl: scholarship.application_url,
      })

      const { error: insertError } = await supabase.from('notifications').insert({
        profile_id: row.profile_id,
        scholarship_id: row.scholarship_id,
        type: 'deadline_reminder',
        sent_at: new Date().toISOString(),
      })

      if (insertError) throw insertError

      results.sent += 1
    } catch (err) {
      results.failed.push({
        scholarship_id: row.scholarship_id,
        profile_id: row.profile_id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    reminder_window_days: reminderDays,
    candidates_evaluated: candidates.length,
    reminders_sent: results.sent,
    failed: results.failed,
  })
}
