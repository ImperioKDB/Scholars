// lib/email/digest.ts
// New-listing digest, shared by the scheduled cron and the admin manual
// trigger (app/api/admin/digest/route.ts) so both run identical logic.
//
// Semantics:
//   - Collect every verified scholarship (undergrad or both) and every
//     verified opportunity created in the last DIGEST_WINDOW_DAYS days.
//   - Per student, skip listings already present in announcement_log, so
//     each student receives each listing exactly once, ever.
//   - Bundle everything pending into ONE email (max DIGEST_CAP tiles plus
//     an "and N more" line). Never one email per listing.
//   - minIntervalMs is the per-student re-blast throttle. The cron passes
//     2 hours; the admin button passes 0 because an admin pressing it just
//     added listings and wants them out now. Listing-level dedupe still
//     holds either way.
//   - Record every pending listing in announcement_log after a successful
//     send (or a dry run), so nothing is re-announced later.
import { createServiceClient } from '@/lib/supabase/service'
import { logError } from '@/lib/logging'
import { renderNewListingsDigest, type EmailListing } from '@/lib/email/template'
import { sendEmail } from '@/lib/email/send'

export const DIGEST_WINDOW_DAYS = 7
export const DIGEST_CAP = 6

const KIND_LABELS: Record<string, string> = {
  fellowship: 'Fellowship',
  internship: 'Internship',
  competition: 'Competition',
  mentorship: 'Mentorship',
}

export type DigestSummary = {
  students_emailed: number
  emails_sent: number
  listings_announced: number
  failed: number
  dry_run: boolean
}

export async function runNewListingDigest(opts: { minIntervalMs?: number } = {}): Promise<DigestSummary> {
  const minIntervalMs = opts.minIntervalMs ?? 0
  const supabase = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
  const summary: DigestSummary = {
    students_emailed: 0,
    emails_sent: 0,
    listings_announced: 0,
    failed: 0,
    dry_run: !process.env.BREVO_API_KEY || !process.env.REMINDER_FROM_EMAIL,
  }
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
    for (const p of (profiles ?? []) as { id: string; email: string; full_name: string | null }[]) {
      const last = lastDigestAt.get(p.id)
      if (minIntervalMs > 0 && last && now - last < minIntervalMs) continue
      const pendingSch = schList.filter((s) => !announced.has(`${p.id}:scholarship:${s.id}`))
      const pendingOpp = oppList.filter((o) => !announced.has(`${p.id}:opportunity:${o.id}`))
      if (pendingSch.length === 0 && pendingOpp.length === 0) continue
      const items: EmailListing[] = [
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
      const logInsert = [
        ...pendingSch.map((s) => ({ profile_id: p.id, listing_kind: 'scholarship', listing_id: s.id })),
        ...pendingOpp.map((o) => ({ profile_id: p.id, listing_kind: 'opportunity', listing_id: o.id })),
      ]
      try {
        const res = await sendEmail({ to: p.email, subject, html, text })
        summary.emails_sent += res.sent
        if (res.dry) summary.dry_run = true
        await supabase.from('announcement_log').insert(logInsert)
        summary.students_emailed += 1
        summary.listings_announced += logInsert.length
      } catch (err) {
        summary.failed += 1
        logError('email/digest', 'digest_send_failed', { profile: p.id }, err)
      }
    }
  } catch (err) {
    summary.failed += 1
    logError('email/digest', 'digest_failed', undefined, err)
  }
  return summary
}
