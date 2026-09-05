// app/api/cron/deadline-check/route.ts
// GET /api/cron/deadline-check
//
// Triggered daily by Vercel Cron (see vercel.json). Three independent phases:
//
//   Phase 1 -- deadline reminders (unchanged behavior): for every saved
//   scholarship whose deadline falls within DEADLINE_REMINDER_DAYS from
//   today, sends one reminder email and records it in `notifications`.
//
//   Phase 2 -- post-deadline check-ins (unchanged): for every tracked
//   application still `in_progress` whose scholarship's deadline has
//   already passed, sends one "did you hear back?" email. This is the
//   email-side companion to Ade's in-app check-in prompt
//   (app/api/mascot/next-prompt) -- the in-app prompt covers someone who
//   opens the app again; this covers someone who doesn't come back on
//   their own.
//
//   Phase 3 -- new-scholarship alerts (unchanged): for every scholarship
//   created or flipped to verified inside the last 7 days, emails every
//   student with a profile. This is the promise the Browse page makes
//   ("We'll notify you once a new one is available"), so it must be real,
//   not aspirational. "New" keys off updated_at because it is now() on
//   insert AND bumped by the set_updated_at trigger on every edit,
//   including the verified flip -- so both "just added" and "just
//   verified" count, while old rows never re-notify. Dedupe per (profile,
//   scholarship) via notifications.type='new_scholarship' (enum value
//   added by a manual ALTER TYPE in the Supabase SQL editor) means a row
//   edited again later never emails the same student twice. Capped at 5
//   scholarships per run; anything beyond that is picked up by the next
//   daily run while still inside the window.
//
// All phases dedupe against `notifications` by (profile_id, scholarship_id,
// type), so a row already in the window on multiple consecutive cron runs
// only sends once, and all phases share the same CRON_SECRET auth and the
// same BREVO_API_KEY / REMINDER_FROM_EMAIL dry-run behavior.
//
// SECURITY HARDENING (phase 4): failures are now visible. Every query
// failure is structured-logged via lib/logging.ts, and if email is
// configured and any phase ends with a non-empty `failed` array, a
// one-line summary is POSTed to CRON_ALERT_WEBHOOK_URL (Slack incoming-
// webhook format). Webhook unset = skipped silently, same dry-run-safe
// pattern as BREVO_API_KEY. A webhook failure never fails the cron
// response.
//
// AUTH: protected by CRON_SECRET, not by user session (there is no user
// session in a cron trigger). Set CRON_SECRET as a normal env var in
// Vercel's Project Settings > Environment Variables (NOT on the Cron Jobs
// page -- that page only shows status/logs/manual-run, nothing to
// configure there). Vercel automatically attaches it as
// `Authorization: Bearer ${CRON_SECRET}` on requests it makes to your
// scheduled paths -- see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
//
// EMAIL PROVIDER: Brevo -- 300 emails/day free forever, no card required.
// DRY-RUN MODE: if BREVO_API_KEY or REMINDER_FROM_EMAIL aren't set, all
// phases still evaluate matches and log what they would send, but send
// nothing and write nothing to `notifications`.
//
// ENV VARS NEEDED:
//   CRON_SECRET            -- random string
//   BREVO_API_KEY          -- optional for now, see dry-run note above
//   REMINDER_FROM_EMAIL    -- optional for now, see dry-run note above
//   DEADLINE_REMINDER_DAYS -- optional, defaults to 7 if unset
//   NEXT_PUBLIC_APP_URL    -- optional, used in email links;
//                              falls back to the production URL if unset
//   CRON_ALERT_WEBHOOK_URL -- optional, Slack-style incoming webhook for
//                              failure summaries; unset = skipped silently
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logError, logWarn } from '@/lib/logging'

const ROUTE = '/api/cron/deadline-check'
const DEFAULT_REMINDER_DAYS = 7
const NEW_WINDOW_DAYS = 7
const MAX_NEW_PER_RUN = 5

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

interface OverdueApplicationRow {
  id: string
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

interface NewScholarshipRow {
  id: string
  title: string
  provider_name: string
  amount: string | null
  deadline: string
  application_url: string | null
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
  if (!apiKey || !from) throw new Error('Missing BREVO_API_KEY or REMINDER_FROM_EMAIL env vars')
  const deadlineFormatted = new Date(params.deadline).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholars' },
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
${params.applicationUrl ? `<p><a href="${params.applicationUrl}">Go to application</a></p>` : ''}
<p>- Ade, from Scholars</p>
`,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
  }
}

async function sendCheckinEmail(params: { to: string; title: string; provider: string }) {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) throw new Error('Missing BREVO_API_KEY or REMINDER_FROM_EMAIL env vars')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholars' },
      to: [{ email: params.to }],
      subject: `Did you hear back from ${params.provider}?`,
      htmlContent: `
<p>Hi,</p>
<p>
The deadline for <strong>${params.title}</strong> (${params.provider}) has passed, and
it's still marked "in progress" on your Applications page.
</p>
<p>Could you let us know what happened? It only takes a tap, and it helps us match you to better scholarships going forward.</p>
<p><a href="${appUrl}/applications">Update it on Scholars</a></p>
<p>- Ade, from Scholars</p>
`,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
  }
}

async function sendNewScholarshipEmail(params: { to: string; scholarship: NewScholarshipRow }) {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) throw new Error('Missing BREVO_API_KEY or REMINDER_FROM_EMAIL env vars')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
  const deadlineFormatted = new Date(params.scholarship.deadline + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: 'Scholars' },
      to: [{ email: params.to }],
      subject: `New scholarship on Scholars: ${params.scholarship.title}`,
      htmlContent: `
<p>Hi,</p>
<p>A new scholarship just went live on Scholars:</p>
<p>
<strong>${params.scholarship.title}</strong><br/>
${params.scholarship.provider_name}<br/>
${params.scholarship.amount ? `Award: ${params.scholarship.amount}<br/>` : ''}
Deadline: <strong>${deadlineFormatted}</strong>
</p>
<p><a href="${appUrl}/scholarships/${params.scholarship.id}">See if you qualify</a></p>
<p>- Ade, from Scholars</p>
`,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Brevo API error ${resp.status}: ${body.slice(0, 300)}`)
  }
}

// Phase 4 failure alerting. Slack incoming-webhook format is just
// { text: string }, which most ops tools (Slack, Discord, Teams, generic
// webhook receivers) accept or adapt trivially. Never throws.
async function sendFailureAlert(summary: string) {
  const webhook = process.env.CRON_ALERT_WEBHOOK_URL
  if (!webhook) return // unset = skip silently, same pattern as BREVO dry-run
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: summary }),
    })
  } catch (err) {
    logWarn(ROUTE, 'failure alert webhook unreachable', undefined, err)
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const emailConfigured = Boolean(process.env.BREVO_API_KEY && process.env.REMINDER_FROM_EMAIL)
  const reminderDays = Number(process.env.DEADLINE_REMINDER_DAYS) || DEFAULT_REMINDER_DAYS
  const supabase = createServiceClient()

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const cutoff = new Date(today)
  cutoff.setUTCDate(cutoff.getUTCDate() + reminderDays)
  const todayStr = today.toISOString().slice(0, 10)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const emailCache = new Map<string, string | null>()
  async function emailFor(profileId: string): Promise<string | null> {
    if (!emailCache.has(profileId)) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profileId)
      emailCache.set(profileId, userError ? null : userData.user?.email ?? null)
    }
    return emailCache.get(profileId) ?? null
  }

  // ---- Phase 1: deadline reminders --------------------------------------
  const { data: saved, error: savedError } = await supabase
    .from('saved_scholarships')
    .select(
      `profile_id, scholarship_id,
       scholarships!inner ( id, title, provider_name, deadline, application_url )`
    )
    .gte('scholarships.deadline', todayStr)
    .lte('scholarships.deadline', cutoffStr)
  if (savedError) {
    logError(ROUTE, 'phase 1 query failed', undefined, savedError)
    return NextResponse.json({ error: savedError.message }, { status: 500 })
  }
  const candidates = ((saved ?? []) as unknown as SavedRow[]).filter((row) => row.scholarships !== null)

  const reminderResults = {
    sent: 0,
    would_send: [] as { profile_id: string; scholarship_id: string; title: string }[],
    failed: [] as { scholarship_id: string; profile_id: string; error: string }[],
  }
  if (candidates.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from('notifications')
      .select('profile_id, scholarship_id')
      .eq('type', 'deadline_reminder')
      .in('scholarship_id', candidates.map((c) => c.scholarship_id))
    if (existingError) {
      logError(ROUTE, 'phase 1 dedupe query failed', undefined, existingError)
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    const alreadyNotified = new Set((existing ?? []).map((n) => `${n.profile_id}:${n.scholarship_id}`))
    const toNotify = candidates.filter((c) => !alreadyNotified.has(`${c.profile_id}:${c.scholarship_id}`))

    for (const row of toNotify) {
      const scholarship = row.scholarships!
      if (!emailConfigured) {
        reminderResults.would_send.push({ profile_id: row.profile_id, scholarship_id: row.scholarship_id, title: scholarship.title })
        continue
      }
      const email = await emailFor(row.profile_id)
      if (!email) {
        reminderResults.failed.push({ scholarship_id: row.scholarship_id, profile_id: row.profile_id, error: 'No email on file for user' })
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
        reminderResults.sent += 1
      } catch (err) {
        reminderResults.failed.push({
          scholarship_id: row.scholarship_id,
          profile_id: row.profile_id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  }

  // ---- Phase 2: post-deadline check-ins ---------------------------------
  const { data: overdueApps, error: overdueError } = await supabase
    .from('applications')
    .select(
      `id, profile_id, scholarship_id,
       scholarships!inner ( id, title, provider_name, deadline, application_url )`
    )
    .eq('status', 'in_progress')
    .lt('scholarships.deadline', todayStr)
  if (overdueError) {
    logError(ROUTE, 'phase 2 query failed', undefined, overdueError)
    return NextResponse.json({ error: overdueError.message }, { status: 500 })
  }
  const overdueCandidates = ((overdueApps ?? []) as unknown as OverdueApplicationRow[]).filter(
    (row) => row.scholarships !== null
  )

  const checkinResults = {
    sent: 0,
    would_send: [] as { profile_id: string; scholarship_id: string; title: string }[],
    failed: [] as { scholarship_id: string; profile_id: string; error: string }[],
  }
  if (overdueCandidates.length > 0) {
    const { data: existingCheckins, error: existingCheckinsError } = await supabase
      .from('notifications')
      .select('profile_id, scholarship_id')
      .eq('type', 'checkin_reminder')
      .in('scholarship_id', overdueCandidates.map((c) => c.scholarship_id))
    if (existingCheckinsError) {
      logError(ROUTE, 'phase 2 dedupe query failed', undefined, existingCheckinsError)
      return NextResponse.json({ error: existingCheckinsError.message }, { status: 500 })
    }
    const alreadyChecked = new Set((existingCheckins ?? []).map((n) => `${n.profile_id}:${n.scholarship_id}`))
    const toCheckin = overdueCandidates.filter((c) => !alreadyChecked.has(`${c.profile_id}:${c.scholarship_id}`))

    for (const row of toCheckin) {
      const scholarship = row.scholarships!
      if (!emailConfigured) {
        checkinResults.would_send.push({ profile_id: row.profile_id, scholarship_id: row.scholarship_id, title: scholarship.title })
        continue
      }
      const email = await emailFor(row.profile_id)
      if (!email) {
        checkinResults.failed.push({ scholarship_id: row.scholarship_id, profile_id: row.profile_id, error: 'No email on file for user' })
        continue
      }
      try {
        await sendCheckinEmail({ to: email, title: scholarship.title, provider: scholarship.provider_name })
        const { error: insertError } = await supabase.from('notifications').insert({
          profile_id: row.profile_id,
          scholarship_id: row.scholarship_id,
          type: 'checkin_reminder',
          sent_at: new Date().toISOString(),
        })
        if (insertError) throw insertError
        checkinResults.sent += 1
      } catch (err) {
        checkinResults.failed.push({
          scholarship_id: row.scholarship_id,
          profile_id: row.profile_id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  }

  // ---- Phase 3: new-scholarship alerts -----------------------------------
  const windowStart = new Date(today)
  windowStart.setUTCDate(windowStart.getUTCDate() - NEW_WINDOW_DAYS)
  const windowStartIso = windowStart.toISOString()

  const { data: fresh, error: freshError } = await supabase
    .from('scholarships')
    .select('id, title, provider_name, amount, deadline, application_url')
    .eq('verified', true)
    .in('level', ['undergrad', 'both'])
    .gte('updated_at', windowStartIso)
    .order('updated_at', { ascending: false })
    .limit(MAX_NEW_PER_RUN)
  if (freshError) {
    logError(ROUTE, 'phase 3 query failed', undefined, freshError)
    return NextResponse.json({ error: freshError.message }, { status: 500 })
  }

  const alertResults = {
    sent: 0,
    would_send: [] as { profile_id: string; scholarship_id: string; title: string }[],
    failed: [] as { scholarship_id: string; profile_id: string; error: string }[],
  }
  const freshRows = (fresh ?? []) as NewScholarshipRow[]
  if (freshRows.length > 0) {
    const { data: allProfiles, error: profilesError } = await supabase.from('profiles').select('id')
    if (profilesError) {
      logError(ROUTE, 'phase 3 profiles query failed', undefined, profilesError)
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }
    const { data: alreadyAlerted, error: alreadyAlertedError } = await supabase
      .from('notifications')
      .select('profile_id, scholarship_id')
      .eq('type', 'new_scholarship')
      .in('scholarship_id', freshRows.map((s) => s.id))
    if (alreadyAlertedError) {
      logError(ROUTE, 'phase 3 dedupe query failed', undefined, alreadyAlertedError)
      return NextResponse.json({ error: alreadyAlertedError.message }, { status: 500 })
    }
    const alertedSet = new Set((alreadyAlerted ?? []).map((n) => `${n.profile_id}:${n.scholarship_id}`))

    for (const scholarship of freshRows) {
      for (const profile of allProfiles ?? []) {
        const pairKey = `${profile.id}:${scholarship.id}`
        if (alertedSet.has(pairKey)) continue
        if (!emailConfigured) {
          alertResults.would_send.push({ profile_id: profile.id, scholarship_id: scholarship.id, title: scholarship.title })
          continue
        }
        const email = await emailFor(profile.id)
        if (!email) {
          alertResults.failed.push({ scholarship_id: scholarship.id, profile_id: profile.id, error: 'No email on file for user' })
          continue
        }
        try {
          await sendNewScholarshipEmail({ to: email, scholarship })
          const { error: insertError } = await supabase.from('notifications').insert({
            profile_id: profile.id,
            scholarship_id: scholarship.id,
            type: 'new_scholarship',
            sent_at: new Date().toISOString(),
          })
          if (insertError) throw insertError
          alertResults.sent += 1
        } catch (err) {
          alertResults.failed.push({
            scholarship_id: scholarship.id,
            profile_id: profile.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }
    }
  }

  // ---- Phase 4: failure alerting ----------------------------------------
  // Only meaningful when email is actually configured (dry-run failures
  // are expected noise), and only when something actually failed.
  const failedCount =
    reminderResults.failed.length + checkinResults.failed.length + alertResults.failed.length
  if (emailConfigured && failedCount > 0) {
    const firstFailures = [
      reminderResults.failed[0],
      checkinResults.failed[0],
      alertResults.failed[0],
    ].filter(Boolean)
    const summary =
      `:warning: Scholars cron ${ROUTE}: ` +
      `${reminderResults.failed.length} deadline-reminder failure(s), ` +
      `${checkinResults.failed.length} check-in failure(s), ` +
      `${alertResults.failed.length} new-scholarship alert failure(s). ` +
      `First errors: ` +
      firstFailures.map((f) => `${f!.scholarship_id.slice(0, 8)}: ${f!.error}`).join(' | ')
    logError(ROUTE, 'run completed with failures', {
      reminder_failures: reminderResults.failed.length,
      checkin_failures: checkinResults.failed.length,
      new_scholarship_failures: alertResults.failed.length,
    })
    await sendFailureAlert(summary)
  }

  return NextResponse.json({
    dry_run: !emailConfigured,
    reminder_window_days: reminderDays,
    new_scholarship_window_days: NEW_WINDOW_DAYS,
    deadline_reminders: reminderResults,
    checkin_reminders: checkinResults,
    new_scholarship_alerts: alertResults,
  })
}
