// app/api/cron/deadline-check/route.ts
// GET /api/cron/deadline-check   (Vercel Cron, every 2 hours: "0 */2 * * *")
//
// Phase 1 - Deadline reminders: one branded email per saved scholarship
//           whose deadline falls inside DEADLINE_REMINDER_DAYS, deduped by
//           the notifications table (type 'deadline_reminder').
// Phase 2 - New-listing DIGEST: instead of one email per new listing (which
//           produced a wall of near-identical emails the minute a batch was
//           verified), collect every verified scholarship AND opportunity
//           created in the last 7 days that this student has not yet been
//           told about, and send ONE digest email (max 6 tiles + "and N
//           more"). A 2-hour per-student guard (announcement_log.created_at)
//           means even repeated manual cron triggers cannot re-blast a
//           student inside the window; pending listings simply wait for the
//           next window.
// Phase 3 - Failure alert: if anything failed and CRON_ALERT_WEBHOOK_URL is
//           set, POST a summary so silent breakage pages you.
//
// Dry-run safe: missing BREVO_API_KEY / REMINDER_FROM_EMAIL logs and skips
// sending but still records dedupe rows, exactly like before.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logError, logWarn, logInfo } from '@/lib/logging'
import {
  renderDeadlineReminder,
  renderNewListingsDigest,
  type EmailListing,
} from '@/lib/email/template'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ROUTE = '/api/cron/deadline-check'
const REMINDER_DAYS = Number(process.env.DEADLINE_REMINDER_DAYS ?? 7)
const DIGEST_CAP = 6
const DIGEST_WINDOW_DAYS = 7
const DIGEST_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours

const KIND_LABELS: Record<string, string> = {
  fellowship: 'Fellowship',
  internship: 'Internship',
  competition: 'Competition',
  mentorship: 'Mentorship',
}

type SendResult = { sent: number; failed: number; dry: boolean }

async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  if (!apiKey || !from) {
    logWarn(ROUTE, 'email_skipped_dry_run', { to: params.to, subject: params.subject })
    return { sent: 0, failed: 0, dry: true }
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
  return { sent: 1, failed: 0, dry: false }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
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
        url: `${baseUrl}/scholarships/${s.id}`,
      }
      const { subject, html, text } = renderDeadlineReminder({
        firstName: p.full_name?.trim().split(/\s+/)[0] || 'there',
        item,
        daysLeft,
        baseUrl,
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

  // ---------- Phase 2: new-listing digest ----------
  try {
    const since = new Date(Date.now() - DIGEST_WINDOW_DAYS * 86400000).toISOString()
    const now = Date.now()
    const [{ data: profiles }, { data: newSch }, { data: newOpp }, { data: logRows }] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name'),
      supabase
        .from('scholarships')
        .select('id,title,provider_name,amount,deadline')
        .eq('verified', true)
        .in('level', ['undergrad', 'both'])
        .gte('created_at', since),
      supabase
        .from('opportunities')
        .select('id,type,title,provider_name,compensation,deadline')
        .eq('verified', true)
        .gte('created_at', since),
      supabase
        .from('announcement_log')
        .select('profile_id,listing_kind,listing_id,created_at')
        .gte('created_at', since),
    ])
    const announced = new Set(
      (logRows ?? []).map((r) => `${r.profile_id}:${r.listing_kind}:${r.listing_id}`)
    )
    const lastDigestAt = new Map<string, number>()
    for (const r of logRows ?? []) {
      const t = Date.parse(r.created_at)
      const prev = lastDigestAt.get(r.profile_id) ?? 0
      if (t > prev) lastDigestAt.set(r.profile_id, t)
    }
    const schList = (newSch ?? []) as { id: string; title: string; provider_name: string; amount: string | null; deadline: string | null }[]
    const oppList = (newOpp ?? []) as { id: string; type: string; title: string; provider_name: string; compensation: string | null; deadline: string | null }[]
    if (schList.length === 0 && oppList.length === 0) {
      logInfo(ROUTE, 'digest_no_new_listings', {})
    }
    for (const p of (profiles ?? []) as { id: string; email: string; full_name: string | null }[]) {
      const last = lastDigestAt.get(p.id)
      if (last && now - last < DIGEST_INTERVAL_MS) continue // inside 2h guard
      const pendingSch = schList.filter((s) => !announced.has(`${p.id}:scholarship:${s.id}`))
      const pendingOpp = oppList.filter((o) => !announced.has(`${p.id}:opportunity:${o.id}`))
      if (pendingSch.length === 0 && pendingOpp.length === 0) continue
      const items: EmailListing = [
        ...pendingSch.map((s) => ({
          id: s.id,
          title: s.title,
          provider_name: s.provider_name,
          amount: s.amount,
          deadline: s.deadline,
          kind_label: 'Scholarship',
          url: `${baseUrl}/scholarships/${s.id}`,
        })),
        ...pendingOpp.map((o) => ({
          id: o.id,
          title: o.title,
          provider_name: o.provider_name,
          amount: o.compensation,
          deadline: o.deadline,
          kind_label: KIND_LABELS[o.type] ?? 'Opportunity',
          url: `${baseUrl}/opportunities/${o.id}`,
        })),
      ]
      const shown = items.slice(0, DIGEST_CAP)
      const moreCount = items.length - shown.length
      const { subject, html, text } = renderNewListingsDigest({
        firstName: p.full_name?.trim().split(/\s+/)[0] || 'there',
        items: shown,
        moreCount,
        baseUrl,
      })
      // Record ALL pending as announced (even the ones folded into "and N
      // more") so they are never re-emailed individually later.
      const logInsert = [
        ...pendingSch.map((s) => ({ profile_id: p.id, listing_kind: 'scholarship', listing_id: s.id })),
        ...pendingOpp.map((o) => ({ profile_id: p.id, listing_kind: 'opportunity', listing_id: o.id })),
      ]
      try {
        const res = await sendEmail({ to: p.email, subject, html, text })
        summary.emails_sent += res.sent
        if (res.dry) summary.dry_run = true
        await supabase.from('announcement_log').insert(logInsert)
        summary.new_listing_digests += 1
      } catch (err) {
        summary.failed += 1
        logError(ROUTE, 'digest_send_failed', { profile: p.id }, err)
      }
    }
  } catch (err) {
    summary.failed += 1
    logError(ROUTE, 'phase2_failed', undefined, err)
  }

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

  logInfo(ROUTE, 'run_complete', summary)
  return NextResponse.json(summary)
}
