// lib/email/profileNudges.ts
// Profile completion nudges, shared by the scheduled cron
// (app/api/cron/deadline-check/route.ts, Phase 1b) and the admin manual
// triggers (app/api/admin/profile-nudges/route.ts) so all of them run
// identical logic -- same pattern as the new-listing digest in
// lib/email/digest.ts.
//
// Semantics:
//   - Targets profiles with profile_completeness < 100, under the
//     PROFILE_NUDGE_MAX_SENDS cap (default 5 total emails per student),
//     whose last nudge is null or older than minIntervalMs (default 2
//     days). Batch-capped per run (PROFILE_NUDGE_BATCH, or
//     PROFILE_NUDGE_FORCE_BATCH for override sends); leftovers are picked
//     up by the next tick or the next override press, oldest/never-emailed
//     first.
//   - Every successful send updates profile_reminder_last_sent_at and
//     increments profile_reminder_count (migration 0018). Cron, routine
//     button, and override button all share that one ledger, so a send
//     from any path pushes the next scheduled send 2 days out: an
//     override press today keeps the GitHub Actions cron quiet until the
//     interval expires, and a recent cron pass is exactly what the
//     routine button skips (and what the override ignores).
//   - ignoreCap (override sends only) drops the 5-email cap filter so a
//     one-off campaign reaches every incomplete profile, including
//     students who already received the maximum routine reminders.
//   - The Lagos daytime window (07:00-19:59 WAT) is enforced for the cron
//     only (enforceSendWindow). Both manual paths are deliberate human
//     actions, so they own their timing; the routine one still keeps
//     interval + cap.
//   - Column probe: if migration 0018 hasn't been applied yet, all
//     callers skip gracefully with skipped_missing_columns instead of
//     failing.
//
// Dry-run safe: missing BREVO_API_KEY / REMINDER_FROM_EMAIL prepares
// everything, updates the ledger, sends nothing (same as the digest).
import { createServiceClient } from '@/lib/supabase/service'
import { logError } from '@/lib/logging'
import { renderProfileNudge } from '@/lib/email/template'
import { sendEmail } from '@/lib/email/send'
export const PROFILE_NUDGE_INTERVAL_MS =
Number(process.env.PROFILE_REMINDER_INTERVAL_DAYS ?? 2) * 86400000
export const PROFILE_NUDGE_MAX_SENDS = Number(process.env.PROFILE_REMINDER_MAX_SENDS ?? 5)
export const PROFILE_NUDGE_BATCH = 200
// Override sends page through the whole incomplete base at this size per
// press. Brevo calls are sequential (~0.2-0.5s each), so 1000 is roughly
// the ceiling the route's 300s maxDuration absorbs; anything beyond it is
// picked up by the next press, because just-sent rows sort last.
export const PROFILE_NUDGE_FORCE_BATCH = 1000
export type ProfileNudgeSummary = {
students_emailed: number
emails_sent: number
failed: number
skipped_missing_columns: boolean
outside_send_window: boolean
dry_run: boolean
}
// Daytime-only sends, Africa/Lagos (UTC+1, no DST): 07:00 to 19:59 local.
// A 2am nudge would just burn goodwill; if a cron tick lands outside the
// window, the phase skips and the next tick inside the window handles it.
function inLagosSendWindow(now: Date): boolean {
const hourWAT = (now.getUTCHours() + 1) % 24
return hourWAT >= 7 && hourWAT < 20
}
// Which of the completeness trigger's 13 fields (see migration 0004,
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
export async function runProfileNudges(
opts: { minIntervalMs?: number; enforceSendWindow?: boolean; ignoreCap?: boolean } = {}
): Promise<ProfileNudgeSummary> {
const minIntervalMs = opts.minIntervalMs ?? PROFILE_NUDGE_INTERVAL_MS
const enforceSendWindow = opts.enforceSendWindow ?? false
const ignoreCap = opts.ignoreCap ?? false
const supabase = createServiceClient()
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
const summary: ProfileNudgeSummary = {
students_emailed: 0,
emails_sent: 0,
failed: 0,
skipped_missing_columns: false,
outside_send_window: false,
dry_run: !process.env.BREVO_API_KEY || !process.env.REMINDER_FROM_EMAIL,
}
if (enforceSendWindow && !inLagosSendWindow(new Date())) {
summary.outside_send_window = true
return summary
}
try {
// Probe first: if migration 0018 isn't applied yet the columns don't
// exist, so skip gracefully instead of failing every run.
const probe = await supabase
.from('profiles')
.select('id, profile_reminder_last_sent_at, profile_reminder_count')
.limit(1)
if (probe.error) {
summary.skipped_missing_columns = true
return summary
}
const cutoff = new Date(Date.now() - minIntervalMs).toISOString()
let query = supabase
.from('profiles')
.select(
'id, email, full_name, profile_completeness, profile_reminder_count, discipline, gpa, nationality, career_goals, date_of_birth, state_of_origin, lga_of_origin, year_of_study, institution_type, jamb_score, waec_credit_count'
)
.lt('profile_completeness', 100)
if (!ignoreCap) {
query = query.lt('profile_reminder_count', PROFILE_NUDGE_MAX_SENDS)
}
const { data: targets, error: targetsError } = await query
.or(`profile_reminder_last_sent_at.is.null,profile_reminder_last_sent_at.lt.${cutoff}`)
.order('profile_reminder_last_sent_at', { ascending: true, nullsFirst: true })
.limit(ignoreCap ? PROFILE_NUDGE_FORCE_BATCH : PROFILE_NUDGE_BATCH)
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
baseUrl,
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
logError('email/profile-nudges', 'state_update_failed', { profile: p.id }, stateError)
}
summary.students_emailed += 1
} catch (err) {
summary.failed += 1
logError('email/profile-nudges', 'send_failed', { profile: p.id }, err)
}
}
} catch (err) {
summary.failed += 1
logError('email/profile-nudges', 'run_failed', undefined, err)
}
return summary
}
