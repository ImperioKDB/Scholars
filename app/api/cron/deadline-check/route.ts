// app/api/cron/deadline-check/route.ts
// GET /api/cron/deadline-check   (Vercel Cron, daily: "0 8 * * *")
//
// Phase 1 - Deadline reminders: one branded email per saved scholarship
//           whose deadline falls inside DEADLINE_REMINDER_DAYS, deduped by
//           the notification_deliveries outbox. The legacy notifications
//           table is still read so the first outbox run does not resend old
//           reminders.
// Phase 1b - Profile completion nudges: delegated to
//           lib/email/profileNudges.ts so the admin manual trigger
//           (app/api/admin/profile-nudges) runs the exact same logic. The
//           cron enforces the Lagos daytime window and the 2-day interval;
//           the manual trigger skips the window (deliberate human action)
//           but keeps interval + cap.
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
import { runProfileNudges, PROFILE_NUDGE_INTERVAL_MS } from '@/lib/email/profileNudges'
import { queueProfileNudges } from '@/lib/email/profileNudgesQueue'
import { renderDeadlineReminder, type EmailListing } from '@/lib/email/template'
import { firstName, getAuthEmailsByUserId } from '@/lib/email/authRecipients'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const ROUTE = '/api/cron/deadline-check'
const REMINDER_DAYS = Number(process.env.DEADLINE_REMINDER_DAYS ?? 7)
const DIGEST_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours
const OUTBOX_LEASE_MS = 10 * 60 * 1000
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
    'profile_id, scholarship_id, scholarship:scholarships(id,title,provider_name,amount,deadline,application_url), profile:profiles(id,full_name)'
),
supabase.from('notifications').select('profile_id, scholarship_id').eq('type', 'deadline_reminder'),
])
    const reminded = new Set((existing ?? []).map((r) => `${r.profile_id}:${r.scholarship_id}`))
const rows = (saved ?? []) as unknown as {
profile_id: string
scholarship_id: string
scholarship: { id: string; title: string; provider_name: string; amount: string | null; deadline: string | null; application_url: string | null } | null
    profile: { id: string; full_name: string | null } | null
  }[]
  const emailById = await getAuthEmailsByUserId(supabase, rows.map((row) => row.profile_id))
  for (const row of rows) {
    const s = row.scholarship
    const p = row.profile
    if (!s || !p || !s.deadline) continue
    const email = emailById.get(row.profile_id)
    if (!email) {
      logWarn(ROUTE, 'reminder_skipped_no_auth_email', { profile: row.profile_id })
      continue
    }
    if (s.deadline < todayIso || s.deadline > windowEnd) continue
    const legacyKey = `${row.profile_id}:${row.scholarship_id}`
    const dedupeKey = `deadline_reminder:${row.profile_id}:${row.scholarship_id}`
    const { error: intentError } = await supabase.from('notification_deliveries').upsert(
      {
        profile_id: row.profile_id,
        scholarship_id: row.scholarship_id,
        campaign_key: 'deadline_reminder',
        channel: 'email',
        schedule_bucket: 'saved-scholarship-deadline',
        dedupe_key: dedupeKey,
        template_version: 'deadline-reminder-v1',
        status: reminded.has(legacyKey) ? 'accepted' : 'pending',
        sent_at: reminded.has(legacyKey) ? new Date().toISOString() : null,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    if (intentError) throw intentError

    const now = new Date()
    const nowIso = now.toISOString()
    const leaseUntil = new Date(now.getTime() + OUTBOX_LEASE_MS).toISOString()
    const { data: claim, error: claimError } = await supabase
      .from('notification_deliveries')
      .update({
        status: 'leased',
        attempts: 1,
        available_at: nowIso,
        lease_until: leaseUntil,
      })
      .eq('dedupe_key', dedupeKey)
      .or(`status.eq.pending,status.eq.retryable,and(status.eq.leased,lease_until.lt.${nowIso})`)
      .lte('available_at', nowIso)
      .select('id')
      .maybeSingle()
    if (claimError) throw claimError
    if (!claim) continue
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
      firstName: firstName(p.full_name),
item,
daysLeft,
baseUrl: baseUrlOf(),
})
try {
      const res = await sendEmail({ to: email, subject, html, text })
summary.emails_sent += res.sent
if (res.dry) summary.dry_run = true
      await supabase
        .from('notification_deliveries')
        .update({ status: 'accepted', sent_at: new Date().toISOString(), lease_until: null })
        .eq('id', claim.id)
        .eq('status', 'leased')
      await supabase.from('notifications').insert({
        profile_id: row.profile_id,
        scholarship_id: row.scholarship_id,
        type: 'deadline_reminder',
      })
      summary.deadline_reminders += 1
    } catch (err) {
      summary.failed += 1
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'retryable',
          lease_until: null,
          available_at: new Date(Date.now() + OUTBOX_LEASE_MS).toISOString(),
          last_error: { message: err instanceof Error ? err.message : String(err) },
        })
        .eq('id', claim.id)
        .eq('status', 'leased')
      logError(ROUTE, 'reminder_send_failed', { profile: row.profile_id, scholarship: row.scholarship_id }, err)
}
}
} catch (err) {
summary.failed += 1
logError(ROUTE, 'phase1_failed', undefined, err)
}
// ---------- Phase 1b: profile completion nudges (shared implementation) ----------
const nudgeOptions = {
minIntervalMs: PROFILE_NUDGE_INTERVAL_MS,
enforceSendWindow: true,
}
const nudges = process.env.PROFILE_NUDGES_USE_INNGEST === 'true'
? await queueProfileNudges(nudgeOptions)
: await runProfileNudges(nudgeOptions)
summary.profile_nudges = 'students_queued' in nudges ? nudges.students_queued : nudges.students_emailed
summary.emails_sent += 'emails_sent' in nudges ? nudges.emails_sent : 0
summary.failed += nudges.failed
if (nudges.skipped_missing_columns) {
logWarn(ROUTE, 'profile_nudge_skipped_missing_columns', {
hint: 'apply migration 0018_add_profile_reminder_tracking.sql',
})
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
return process.env.NEXT_PUBLIC_APP_URL || 'https://www.scholars.com.ng'
}
