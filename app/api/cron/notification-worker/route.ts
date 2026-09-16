import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthEmailsByUserId, firstName } from '@/lib/email/authRecipients'
import { sendEmail } from '@/lib/email/send'
import { renderNewListingsDigest, renderProfileNudge, renderReengagementNudge, type EmailListing } from '@/lib/email/template'
import { missingProfileLabels } from '@/lib/email/profileNudges'
import { logError, logWarn } from '@/lib/logging'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ROUTE = '/api/cron/notification-worker'
const BATCH_SIZE = 50
const MAX_ATTEMPTS = 5
const LEASE_MS = 10 * 60 * 1000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const summary = { claimed: 0, sent: 0, failed: 0, dead_lettered: 0, dry_run: !process.env.BREVO_API_KEY || !process.env.REMINDER_FROM_EMAIL }
  const now = new Date()
  const nowIso = now.toISOString()

  try {
    const { data: candidates, error } = await supabase
      .from('notification_deliveries')
      .select('id,profile_id,scholarship_id,campaign_key,dedupe_key,template_version,attempts,status,lease_until')
      .or(`status.eq.retryable,and(status.eq.leased,lease_until.lt.${nowIso})`)
      .lte('available_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)
    if (error) throw error

    for (const candidate of candidates ?? []) {
      if ((candidate.attempts ?? 0) >= MAX_ATTEMPTS) {
        const { error: deadLetterError } = await supabase
          .from('notification_deliveries')
          .update({ status: 'dead_letter', lease_until: null })
          .eq('id', candidate.id)
          .in('status', ['retryable', 'leased'])
        if (deadLetterError) throw deadLetterError
        summary.dead_lettered += 1
        continue
      }

      const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString()
      const { data: claim, error: claimError } = await supabase
        .from('notification_deliveries')
        .update({ status: 'leased', attempts: (candidate.attempts ?? 0) + 1, lease_until: leaseUntil })
        .eq('id', candidate.id)
        .or(`status.eq.retryable,and(status.eq.leased,lease_until.lt.${nowIso})`)
        .select('id')
        .maybeSingle()
      if (claimError) throw claimError
      if (!claim) continue
      summary.claimed += 1

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', candidate.profile_id)
          .maybeSingle()
        if (profileError) throw profileError
        if (!profile) throw new Error(`Profile not found: ${candidate.profile_id}`)
        const emails = await getAuthEmailsByUserId(supabase, [candidate.profile_id])
        const email = emails.get(candidate.profile_id)
        if (!email) throw new Error(`Auth email not found: ${candidate.profile_id}`)

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://scholars-eight.vercel.app'
        let rendered: { subject: string; html: string; text: string }
        if (candidate.campaign_key === 'profile_nudge') {
          rendered = renderProfileNudge({
            firstName: firstName(profile.full_name),
            completeness: profile.profile_completeness,
            missingLabels: missingProfileLabels(profile),
            baseUrl,
          })
        } else if (candidate.campaign_key === 'new_listing_digest') {
          rendered = await renderDigestFromKey(supabase, candidate.dedupe_key, profile.full_name, baseUrl)
        } else if (candidate.campaign_key === 'reengagement_treatment') {
          rendered = await renderTreatmentFromKey(supabase, candidate.dedupe_key, profile.full_name, baseUrl)
        } else {
          throw new Error(`Unsupported campaign: ${candidate.campaign_key}`)
        }

        const result = await sendEmail({ to: email, ...rendered })
        summary.sent += result.sent
        if (result.dry) summary.dry_run = true
        const { error: acceptedError } = await supabase
          .from('notification_deliveries')
          .update({ status: 'accepted', sent_at: new Date().toISOString(), lease_until: null })
          .eq('id', claim.id)
          .eq('status', 'leased')
        if (acceptedError) throw acceptedError
      } catch (err) {
        summary.failed += 1
        await supabase
          .from('notification_deliveries')
          .update({
            status: 'retryable',
            lease_until: null,
            available_at: new Date(Date.now() + LEASE_MS).toISOString(),
            last_error: { message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500) },
          })
          .eq('id', claim.id)
          .eq('status', 'leased')
          .then(({ error: retryError }) => {
            if (retryError) logError(ROUTE, 'retry_state_failed', { delivery: claim.id }, retryError)
          })
        logError(ROUTE, 'delivery_failed', { delivery: claim.id }, err)
      }
    }
  } catch (err) {
    logError(ROUTE, 'worker_failed', undefined, err)
    return NextResponse.json({ ...summary, error: 'Worker query failed' }, { status: 500 })
  }

  logWarn(ROUTE, 'worker_complete', summary)
  return NextResponse.json(summary)
}

async function renderTreatmentFromKey(
  supabase: ReturnType<typeof createServiceClient>,
  dedupeKey: string,
  fullName: string | null,
  baseUrl: string,
): Promise<{ subject: string; html: string; text: string }> {
  const [, , assignmentId] = dedupeKey.split(':')
  if (!assignmentId) throw new Error(`Invalid re-engagement delivery key: ${dedupeKey}`)
  const { data: assignment, error } = await supabase
    .from('reengagement_assignments')
    .select('id,deep_link,next_action')
    .eq('id', assignmentId)
    .maybeSingle()
  if (error) throw error
  if (!assignment) throw new Error(`Assignment not found: ${assignmentId}`)
  return renderReengagementNudge({
    firstName: firstName(fullName),
    nextAction: assignment.next_action,
    clickUrl: `${baseUrl}/api/reengagement/click/${assignment.id}`,
    baseUrl,
  })
}

async function renderDigestFromKey(
  supabase: ReturnType<typeof createServiceClient>,
  dedupeKey: string,
  fullName: string | null,
  baseUrl: string,
): Promise<{ subject: string; html: string; text: string }> {
  const [, , ...refs] = dedupeKey.split(':')
  const scholarshipIds = refs.filter((ref) => ref.startsWith('scholarship:')).map((ref) => ref.slice('scholarship:'.length))
  const opportunityIds = refs.filter((ref) => ref.startsWith('opportunity:')).map((ref) => ref.slice('opportunity:'.length))
  const [{ data: scholarships, error: scholarshipError }, { data: opportunities, error: opportunityError }] = await Promise.all([
    scholarshipIds.length
      ? supabase.from('scholarships').select('id,title,provider_name,amount,deadline').in('id', scholarshipIds)
      : Promise.resolve({ data: [], error: null }),
    opportunityIds.length
      ? supabase.from('opportunities').select('id,type,title,provider_name,compensation,deadline').in('id', opportunityIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (scholarshipError) throw scholarshipError
  if (opportunityError) throw opportunityError
  const labels: Record<string, string> = { fellowship: 'Fellowship', internship: 'Internship', competition: 'Competition', mentorship: 'Mentorship' }
  const items: EmailListing[] = [
    ...(scholarships ?? []).map((item) => ({ id: item.id, title: item.title, provider_name: item.provider_name, amount: item.amount, deadline: item.deadline, kind_label: 'Scholarship', url: `${baseUrl}/scholarships/${item.id}` })),
    ...(opportunities ?? []).map((item) => ({ id: item.id, title: item.title, provider_name: item.provider_name, amount: item.compensation, deadline: item.deadline, kind_label: labels[item.type] ?? 'Opportunity', url: `${baseUrl}/opportunities/${item.id}` })),
  ]
  if (items.length === 0) throw new Error(`No listings found for ${dedupeKey}`)
  return renderNewListingsDigest({ firstName: firstName(fullName), items: items.slice(0, 6), moreCount: Math.max(0, items.length - 6), baseUrl })
}
