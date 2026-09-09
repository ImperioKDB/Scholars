// app/api/cron/deadline-check/route.ts
// GET /api/cron/deadline-check   (Vercel Cron, daily: "0 16 * * *")
//
// Phase 1 - Deadline reminders: one branded email per saved scholarship
//           whose deadline falls inside DEADLINE_REMINDER_DAYS, deduped by
//           the notifications table (type 'deadline_reminder').
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
import { renderDeadlineReminder, type EmailListing } from '@/lib/email/template'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ROUTE = '/api/cron/deadline-check'
const REMINDER_DAYS = Number(process.env.DEADLINE_REMINDER_DAYS ?? 7)
const DIGEST_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  const summary = {
    deadline_reminders: 0,
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
          text: `Scholars cron: ${summary.failed} failure(s) in deadline-check. reminders=${summary.deadline_reminders} digests=${summary.new_listing_digests} sent=${summary.emails_sent}`,
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
