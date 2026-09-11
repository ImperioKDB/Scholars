// app/api/cron/deadline-check/route.ts
// GET /api/cron/deadline-check   (Vercel Cron, daily: "0 16 * * *")
//
// Phase 1 - Deadline reminders: one branded email per saved scholarship
//           whose deadline falls inside DEADLINE_REMINDER_DAYS, deduped by
//           the notifications table (type 'deadline_reminder').
// Phase 1b - Profile completion nudges: students whose profile is under
//           100% get a reminder at most every PROFILE_REMINDER_INTERVAL_DAYS
//           days (default 2), capped at PROFILE_REMINDER_MAX_SENDS total
//           sends (default 5), and only during daytime Nigeria hours.
//           State lives on profiles (migration 0018):
//           profile_reminder_last_sent_at + profile_reminder_count. The
//           phase probes for those columns first and skips silently if the
//           migration hasn't been applied yet, so the cron never breaks.
// Phase 2 - New-listing DIGEST: delegated to lib/email/digest.ts so the
//           admin manual trigger (app/api/admin/digest) runs the exact
//           same logic. The cron passes the 2-hour per-student throttle;
//           the manual trigger skips it.
// Phase 3 - Failure alert: if anything failed and CRON_ALERT_WEBHOOK_URL
//           is set, POST a summary so silent breakage pages you.
//
// Dry-run safe: missing BREVO_API_KEY / REMINDER_FROM_EMAIL logs and skips
// sending but still records dedupe rows, exactly like before.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logError, logWarn } from '@/lib/logging'
import { sendEmail } from '@/lib/email/send'
import { runNewListingDigest } from '@/lib/email/digest'
import { renderDeadlineReminder, renderProfileNudge, type EmailListing } from '@/lib/email/template'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ROUTE = '/api/cron/deadline-check'
const REMINDER_DAYS = Number(process.env.DEADLINE_REMINDER_DAYS ?? 7)
const DIGEST_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours

// Phase 1b (profile completion nudges) config. The 2-day interval is
// enforced DB-side (profile_reminder_last_sent_at), so it holds no matter
// how often this endpoint is hit -- Vercel's once-a-day cron or the
// GitHub Actions workflow that calls every 2 hours.
const PROFILE_NUDGE_INTERVAL_MS =
Number(process.env.PROFILE_REMINDER_INTERVAL_DAYS ?? 2) * 86400000
const PROFILE_NUDGE_MAX_SENDS = Number(process.env.PROFILE_REMINDER_MAX_SENDS ?? 5)
const PROFILE_NUDGE_BATCH = 200

// Daytime-only sends, Africa/Lagos (UTC+1, no DST): 07:00 to 19:59 local.
// A 2am nudge would just burn goodwill; if a cron tick lands outside the
// window, the phase skips and the next tick inside the window handles it.
function inLagosSendWindow(now: Date): boolean {
const hourWAT = (now.getUTCHours() + 1) % 24
return hourWAT >= 7 && hourWAT < 20
}

// Which of the completeness-trigger's 13 fields (see migration 0004,
// calculate_profile_completeness) are still empty on this row, so the
// email can say exactly what's missing. financial_need is excluded: it has
// a default, so the trigger always counts it as filled.
function missingProfileLabels(p: Record<string, unknown>): string[] {
const checks: [string, boolean][] = [
['full name', Boolean(p.full_name)],
['field of study', Boolean(p.discipline)],
['GPA', p.gpa != null],
['nationality', Boolean(p.nationality)],
['career goals', Boolean(p.career_goals)],
['date of birth', Boolean(p.date_of_birth)],
['state of origin', Boolean(p.state_of_origin)],
['LGA of origin', Boolean(p.lga_of_origin)],
['year of study', p.year_of_study != null],
['institution type', p.institution_type != null],
['JAMB score', p.jamb_score != null],
['WAEC credit count', p.waec_credit_count != null],
]
return checks.filter(([, filled]) => !filled).map(([label]) => label)
}

export async function GET(request: Request) {
const secret = process.env.CRON_SECRET
const auth = request.headers.get('authorization')
if (!secret || auth !== `Bearer ${secret}`) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const supabase = createServiceClient()

const summary = {
deadline_reminders: 0,
profile_nudges: 0,
new_listing_digests: 0,
emails_sent: 0,
failed: 0,
dry_run: !process.env.BREVO_API_KEY || !process.env.REMINDER_FROM_EMAIL,
}

// ---------- Phase 1: deadline reminders ----------
try {
const todayIso = new Date().toISOString().slice(0, 10)
const windowEnd = new Date(Date.now() + REMINDER_DAYS * 86400000).toISOString().slice(0, 10)

const [{ data: saved }, { data: existing }] = await Promise.all([
supabase
.from('saved_scholarships')
.select(
'profile_id, scholarship_id, scholarship:scholarships(id,title,provider_name,amount,deadline,application_url), profile:profiles(id,email,full_name)'
),
supabase.from('notifications').select('profile_id, scholarship_id').eq('type', 'deadline_reminder'),
])

const reminded = new Set((existing ?? []).map((r) => `${r.profile_id}:${r.scholarship_id}`))
const rows = (saved ?? []) as unknown as {
profile_id: string
scholarship_id: string
scholarship: { id: string; title: string; provider_name: string; amount: string | null; deadline: string | null; application_url: string | null } | null
profile: { id: string; email: string; full_name: string | null } | null
}[]

for (const row of rows) {
const s = row.scholarship
const p = row.profile
if (!s || !p || !s.deadline) continue
if (s.deadline < todayIso || s.deadline > windowEnd) continue
const key = `${row.profile_id}:${row.scholarship_id}`
if (reminded.has(key)) continue

const daysLeft = Math.max(0, Math.round((Date.parse(s.deadline) - Date.parse(todayIso)) / 86400000))
const item: EmailListing = {
id: s.id,
title: s.title,
provider_name: s.provider_name,
amount: s.amount,
deadline: s.deadline,
kind_label: 'Scholarship',
url: `${baseUrlOf()}/scholarships/${s.id}`,
}
const { subject, html, text } = renderDeadlineReminder({
firstName: p.full_name?.trim().split(/\s+/)[0] || 'there',
item,
daysLeft,
baseUrl: baseUrlOf(),
})
try {
const res = await sendEmail({ to: p.email, subject, html, text })
summary.emails_sent += res.sent
if (res.dry) summary.dry_run = true
await supabase.from('notifications').insert({
profile_id: row.profile_id,
scholarship_id: row.scholarship_id,
type: 'deadline_reminder',
})
summary.deadline_reminders += 1
} catch (err) {
summary.failed += 1
logError(ROUTE, 'reminder_send_failed', { profile: row.profile_id, scholarship: row.scholarship_id }, err)
}
}
} catch (err) {
summary.failed += 1
logError(ROUTE, 'phase1_failed', undefined, err)
}

// ---------- Phase 1b: profile completion nudges ----------
try {
if (inLagosSendWindow(new Date())) {
// Probe first: if migration 0018 isn't applied yet the columns don't
// exist, so skip silently instead of failing every cron run.
const probe = await supabase
.from('profiles')
.select('id, profile_reminder_last_sent_at, profile_reminder_count')
.limit(1)
if (probe.error) {
logWarn(ROUTE, 'profile_nudge_skipped_missing_columns', {
hint: 'apply migration 0018_add_profile_reminder_tracking.sql',
})
} else {
const cutoff = new Date(Date.now() - PROFILE_NUDGE_INTERVAL_MS).toISOString()
const { data: targets, error: targetsError } = await supabase
.from('profiles')
.select(
'id, email, full_name, profile_completeness, profile_reminder_count, discipline, gpa, nationality, career_goals, date_of_birth, state_of_origin, lga_of_origin, year_of_study, institution_type, jamb_score, waec_credit_count'
)
.lt('profile_completeness', 100)
.lt('profile_reminder_count', PROFILE_NUDGE_MAX_SENDS)
.or(`profile_reminder_last_sent_at.is.null,profile_reminder_last_sent_at.lt.${cutoff}`)
.order('profile_reminder_last_sent_at', { ascending: true, nullsFirst: true })
.limit(PROFILE_NUDGE_BATCH)
if (targetsError) throw targetsError

for (const p of (targets ?? []) as (Record<string, unknown> & {
id: string
email: string
full_name: string | null
profile_completeness: number
profile_reminder_count: number | null
})[]) {
const { subject, html, text } = renderProfileNudge({
firstName: p.full_name?.trim().split(/\s+/)[0] || 'there',
completeness: p.profile_completeness,
missingLabels: missingProfileLabels(p),
baseUrl: baseUrlOf(),
})
try {
const res = await sendEmail({ to: p.email, subject, html, text })
summary.emails_sent += res.sent
if (res.dry) summary.dry_run = true
const { error: stateError } = await supabase
.from('profiles')
.update({
profile_reminder_last_sent_at: new Date().toISOString(),
profile_reminder_count: (p.profile_reminder_count ?? 0) + 1,
})
.eq('id', p.id)
if (stateError) {
// Email already went out; worst case one extra nudge later.
logError(ROUTE, 'profile_nudge_state_update_failed', { profile: p.id }, stateError)
}
summary.profile_nudges += 1
} catch (err) {
summary.failed += 1
logError(ROUTE, 'profile_nudge_send_failed', { profile: p.id }, err)
}
}
}
}
} catch (err) {
summary.failed += 1
logError(ROUTE, 'phase1b_failed', undefined, err)
}

// ---------- Phase 2: new-listing digest (shared implementation) ----------
const digest = await runNewListingDigest({ minIntervalMs: DIGEST_INTERVAL_MS })
summary.new_listing_digests = digest.students_emailed
summary.emails_sent += digest.emails_sent
summary.failed += digest.failed
if (digest.dry_run) summary.dry_run = true

// ---------- Phase 3: failure alert ----------
if (summary.failed > 0) {
const webhook = process.env.CRON_ALERT_WEBHOOK_URL
if (webhook) {
await fetch(webhook, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
text: `Scholars cron: ${summary.failed} failure(s) in deadline-check. reminders=${summary.deadline_reminders} profile_nudges=${summary.profile_nudges} digests=${summary.new_listing_digests} sent=${summary.emails_sent}`,
}),
}).catch(() => {})
}
}

logWarn(ROUTE, 'run_complete', summary)
return NextResponse.json(summary)
}

function baseUrlOf(): string {
return process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
}
