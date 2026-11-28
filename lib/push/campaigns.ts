import type { SupabaseClient } from '@supabase/supabase-js'
import { daysUntil } from '@/lib/dates'
import { rankScholarships } from '@/lib/matching/engine'
import { toMatchableProfile, type MatchableProfileSource } from '@/lib/matching/profileMapper'
import type { ScholarshipRow, ScholarshipRule } from '@/lib/matching/types'
import { sendPushForProfile } from './deliver'

type DiscoveryPage = {
  phase: 'discovery'
  day: string
  profiles: ({ id: string } & MatchableProfileSource)[]
  scholarships: ScholarshipRow[]
  rules: ScholarshipRule[]
}
type CampaignStep = DiscoveryPage | { phase: 'busy' } | { phase: 'delivery' }
type DeliveryBundle = {
  profile_id: string
  web_enabled: boolean
  items: { id: string; title: string }[]
}
type ClaimResult = {
  bundles: DeliveryBundle[]
  suppressedDeliveries: number
  unknownDeliveries: number
  deadLetterDeliveries: number
}
type DeliveryResult = Omit<ClaimResult, 'bundles'> & {
  more: boolean
  retryableDeliveries: number
  failedDeliveries: number
  newMatchPushesAccepted: number
  retryPushesAccepted: number
}
type Outcome = 'accepted' | 'retryable' | 'suppressed' | 'unknown' | 'failed'

async function rpc<T>(service: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await service.rpc(name, args).retry(false)
  if (error) throw error
  return data as T
}

function cleanTitle(title: string) {
  return title.replace(/\s+/g, ' ').trim().slice(0, 120) || 'this scholarship'
}

function discover(page: DiscoveryPage) {
  const rules = new Map<string, ScholarshipRule[]>()
  for (const rule of page.rules) {
    const group = rules.get(rule.scholarship_id) ?? []
    group.push(rule)
    rules.set(rule.scholarship_id, group)
  }

  return page.profiles.flatMap((profile) => rankScholarships(
    toMatchableProfile(profile), page.scholarships, rules,
  ).filter((match) => match.tier !== 'unlikely').slice(0, 5).map((match) => ({
    profile_id: profile.id,
    scholarship_id: match.id,
    title: cleanTitle(match.title),
    days_until: daysUntil(match.deadline),
  })))
}

async function deliver(service: SupabaseClient, bundle: DeliveryBundle): Promise<Outcome> {
  const count = bundle.items.length
  try {
    const result = await sendPushForProfile(service, bundle.profile_id, {
      title: count === 1 ? 'A new scholarship match' : `${count} new scholarship matches`,
      body: count === 1
        ? `${cleanTitle(bundle.items[0].title)} may fit your profile. View your new match in Scholars.`
        : `${count} newly verified scholarships may fit your profile. View your fresh matches in Scholars.`,
      data: { url: '/dashboard/fresh-matches' },
    }, { deviceLimit: 4 })

    if (result.accepted > 0) return 'accepted'
    if (result.uncertain) return 'unknown'
    if (result.retryable > 0) return 'retryable'
    if (bundle.web_enabled && !(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY)) {
      return 'failed'
    }
    if (result.failed === result.expired && result.targets === result.expired) return 'suppressed'
    return 'failed'
  } catch {
    // A thrown provider call may have been accepted before it lost its response.
    return 'unknown'
  }
}

/** Discovery and delivery have separate, fixed bounds. Both cron entry points use the same lease. */
export async function runDailyPushCampaign(service: SupabaseClient, startWindow = false) {
  const owner = crypto.randomUUID()
  const step = await rpc<CampaignStep>(service, 'begin_new_match_step', {
    p_owner: owner, p_start_window: startWindow,
  })
  if (step.phase === 'busy') return { phase: step.phase, more: true }

  if (step.phase === 'discovery') {
    const result = await rpc<{ more: boolean; queued: number }>(service, 'commit_new_match_page', {
      p_owner: owner, p_day: step.day, p_matches: discover(step),
    })
    return { ...result, phase: step.phase, profilesCheckedForMatches: step.profiles.length }
  }

  // The claim allows at most four bundles. Each costs at most three Expo and
  // six Web Push requests. Begin, claim, finish and the maintenance flag RPC
  // bring the maximum to 40. Finish capacity is included before any send.
  const batch = await rpc<ClaimResult>(service, 'claim_new_match_batch', { p_owner: owner })
  const outcomes = await Promise.all(batch.bundles.map(async (bundle) => ({
    ids: bundle.items.map(({ id }) => id),
    status: await deliver(service, bundle),
  })))
  const result = await rpc<DeliveryResult>(
    service, 'finish_new_match_batch', { p_owner: owner, p_outcomes: outcomes },
  )
  return {
    ...result,
    phase: step.phase,
    suppressedDeliveries: batch.suppressedDeliveries + result.suppressedDeliveries,
    unknownDeliveries: batch.unknownDeliveries + result.unknownDeliveries,
    deadLetterDeliveries: batch.deadLetterDeliveries + result.deadLetterDeliveries,
  }
}
