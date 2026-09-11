// lib/email/profileNudges.ts
// Profile completion nudges, shared by the scheduled cron
// (app/api/cron/deadline-check/route.ts, Phase 1b) and the admin manual
// triggers (app/api/admin/profile-nudges/route.ts) so both run identical
// logic -- same pattern as the new-listing digest in lib/email/digest.ts.
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
// ROBUSTNESS (bug fix, round 2): the recipient query used to compose a
// long explicit column list (including an assumed profiles.email), an
// .or() timestamp filter and a server-side order(). One unknown column or
// filter-parse complaint in that composition aborted the entire pass with
// a single failure, and because PostgREST errors are plain objects the
// admin UI rendered them as "[object Object]". Now:
//   - the only DB filter is select('*') + lt('profile_completeness', 100),
//     the exact shape the admin stats tile already runs successfully;
//   - interval, cap, nulls-first sorting and batching happen in JS;
//   - emails come from auth.admin.listUsers (service role, paginated),
//     the authoritative source, instead of a denormalized column;
//   - errorText() extracts .message from anything error-shaped so the
//     admin UI always shows the real reason a pass sent nothing.
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
first_error: string | null
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
// PostgREST errors are plain objects ({ message, details, hint, code }),
// NOT Error instances, so `err instanceof Error ? err.message :
// String(err)` rendered them as "[object Object]" in the admin UI. Pull
// .message off anything error-shaped; JSON-stringify the rest.
function errorText(err: unknown): string {
if (err instanceof Error) return err.message
if (err && typeof err === 'object') {
const m = (err as { message?: unknown }).message
if (typeof m === 'string' && m) return m
try {
return JSON.stringify(err)
} catch {
return String(err)
}
}
return String(err)
}
type ProfileRow = Record<string, unknown> & {
id: string
profile_completeness: number
profile_reminder_count: number | null
profile_reminder_last_sent_at: string | null
full_name?: string | null
}
function lastSentMs(p: ProfileRow): number {
// -1 sorts never-reminded students first; unparseable stamps are treated
// as never-reminded rather than silently dropping the student.
if (p.profile_reminder_last_sent_at == null) return -1
const t = Date.parse(p.profile_reminder_last_sent_at)
return Number.isNaN(t) ? -1 : t
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
first_error: null,
}
// Record the first failure message so the admin UI can show WHY a pass
// sent nothing, not just that it did. Later failures stay in the logs.
function noteError(err: unknown) {
if (summary.first_error === null) {
summary.first_error = errorText(err)
}
}
if (enforceSendWindow && !inLagosSendWindow(new Date())) {
summary.outside_send_window = true
return summary
}
try {
// Probe first: if migration 0018 isn't applied yet the ledger columns
// don't exist, so skip gracefully instead of failing every run.
const probe = await supabase
.from('profiles')
.select('id, profile_reminder_last_sent_at, profile_reminder_count')
.limit(1)
if (probe.error) {
summary.skipped_missing_columns = true
return summary
}
// Recipients: the minimal proven query shape (select star plus the same
// single lt filter the admin stats tile runs). Interval, cap, ordering
// and batching are applied in JS below so no filter composition can
// abort the pass server-side.
const { data: rows, error: rowsError } = await supabase
.from('profiles')
.select('*')
.lt('profile_completeness', 100)
if (rowsError) throw rowsError
const cutoffMs = Date.now() - minIntervalMs
const eligible = ((rows ?? []) as unknown as ProfileRow[])
.filter((r) => (ignoreCap ? true : (r.profile_reminder_count ?? 0) < PROFILE_NUDGE_MAX_SENDS))
.filter((r) => lastSentMs(r) < cutoffMs)
.sort((a, b) => lastSentMs(a) - lastSentMs(b))
.slice(0, ignoreCap ? PROFILE_NUDGE_FORCE_BATCH : PROFILE_NUDGE_BATCH)
// Emails come from auth (the authoritative source) via the service role,
// paginated, so the pass never depends on a denormalized email column
// existing on profiles or staying in sync with sign-in changes.
const emailById = new Map<string, string>()
for (let page = 1; page <= 100; page++) {
const { data, error: usersError } = await supabase.auth.admin.listUsers({
page,
perPage: 100,
})
if (usersError) throw usersError
const users = data?.users ?? []
for (const u of users) {
if (u.id && u.email) emailById.set(u.id, u.email)
}
if (users.length < 100) break
}
for (const p of eligible) {
const email = emailById.get(p.id)
if (!email) {
// Profile row without a matching auth user (deleted account edge):
// nothing to email, and not a send failure either.
logError('email/profile-nudges', 'no_email_for_profile', { profile: p.id })
continue
}
const { subject, html, text } = renderProfileNudge({
firstName: p.full_name?.trim().split(/\s+/)[0] || 'there',
completeness: p.profile_completeness,
missingLabels: missingProfileLabels(p),
baseUrl,
})
try {
const res = await sendEmail({ to: email, subject, html, text })
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
noteError(err)
logError('email/profile-nudges', 'send_failed', { profile: p.id, email }, err)
}
}
} catch (err) {
summary.failed += 1
noteError(err)
logError('email/profile-nudges', 'run_failed', undefined, err)
}
return summary
}
