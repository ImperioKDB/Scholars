import type { SupabaseClient } from '@supabase/supabase-js'
import { daysUntil, todayUtcIso } from '@/lib/dates'
import { rankScholarships } from '@/lib/matching/engine'
import { toMatchableProfile, type MatchableProfileSource } from '@/lib/matching/profileMapper'
import type { ScholarshipRow, ScholarshipRule } from '@/lib/matching/types'
import {
  claimNotificationDeliveryById,
  ensureNotificationDelivery,
  markNotificationAccepted,
  markNotificationRetryable,
} from '@/lib/email/outbox'
import { sendPushForProfile } from './deliver'
import {
  getSafePushErrorDiagnostic,
  getSafeHttpStatusCode,
} from './errorDiagnostics'

const PAGE_SIZE = 500
const MAX_DEVICE_ROWS_PER_CHANNEL = 10_000
const MAX_ACTIVE_PROFILES = 2_000
const MAX_RECENT_SCHOLARSHIPS = 250
const MAX_MATCHES_PER_PROFILE = 5
const MATCH_LOOKBACK_HOURS = 48
const MAX_GROUP_CONCURRENCY = 8
const RETRY_BATCH_LIMIT = 500
const MAX_RETRY_AGE_DAYS = 7

/**
 * Bounded external subrequest budget for a single daily maintenance invocation.
 *
 * Cloudflare Workers Free permits only 50 external subrequests per invocation,
 * and every Supabase query (plus Expo/web-push fetches) counts as one. This
 * budget keeps a single maintenance run safely below that ceiling while leaving
 * headroom for the cron route's other work (flag_expired_opportunities RPC) and
 * framework overhead. Provider sends are counted toward the budget.
 *
 * Budget is enforced strictly before every external subrequest; when it is
 * exhausted the run stops, reports `more: true` / `budgetExhausted: true`, and
 * the remaining work is resumed on the next scheduled invocation.
 */
const SUBREQUEST_BUDGET = 25

/**
 * Maximum number of profile groups to claim and deliver in one invocation.
 * Prevents a single run from exhausting the subrequest budget on new matches.
 */
const MAX_NEW_MATCH_BATCHES = 12

export type ScheduledPushCampaignResult = {
  activeProfiles: number
  profilesCheckedForMatches: number
  newMatchPushesAccepted: number
  retryPushesAccepted: number
  suppressedDeliveries: number
  retryableDeliveries: number
  more: boolean
}

type CandidateAlert = {
  profileId: string
  scholarshipId: string
  title: string
  deadline: string | null
  daysUntil: number | null
  dedupeKey: string
}
type ClaimedAlert = CandidateAlert & { deliveryId: string }
type MatchableProfile = { id: string } & MatchableProfileSource
type PushScholarship = ScholarshipRow & { last_verified_at: string | null }
type RetryRow = {
  id: string
  profile_id: string
  scholarship_id: string | null
  dedupe_key: string
}
type DeliveryOutcome = 'accepted' | 'suppressed' | 'retryable'

/** Diagnostics surfaced when an invocation cannot complete within its budget. */
export type CampaignBudgetDiagnostic = {
  subrequestsUsed: number
  subrequestBudget: number
  budgetExhausted: boolean
  truncatedBatches: number
  lastErrorName?: string | null
  lastErrorCode?: string | null
}

async function loadActivePushProfileIds(
  supabase: SupabaseClient,
  budget: CampaignBudgetDiagnostic,
): Promise<string[]> {
  const profileIds = new Set<string>()
  const sources = ['push_tokens', 'web_push_subscriptions'] as const

  await Promise.all(sources.map(async (table) => {
    for (let offset = 0; offset < MAX_DEVICE_ROWS_PER_CHANNEL; offset += PAGE_SIZE) {
      if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) break
      budget.subrequestsUsed += 1
      const { data, error } = await supabase
        .from(table)
        .select('id,profile_id')
        .eq('enabled', true)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      for (const row of data ?? []) profileIds.add(row.profile_id as string)
      if (!data || data.length < PAGE_SIZE) break
      if (offset + PAGE_SIZE >= MAX_DEVICE_ROWS_PER_CHANNEL) {
        console.warn('[PushCampaign] Device scan reached its safety cap', { table })
      }
    }
  }))

  return Array.from(profileIds).slice(0, MAX_ACTIVE_PROFILES)
}

async function loadMatchableProfiles(
  supabase: SupabaseClient,
  profileIds: string[],
  budget: CampaignBudgetDiagnostic,
): Promise<MatchableProfile[]> {
  const profiles: MatchableProfile[] = []
  const columns = [
    'id', 'discipline', 'gpa', 'nationality', 'gender', 'financial_need',
    'date_of_birth', 'state_of_origin', 'lga_of_origin', 'year_of_study',
    'institution_type', 'jamb_score', 'waec_credit_count',
    'has_english_maths_credit', 'disability_status', 'profile_completeness',
  ].join(',')

  for (let offset = 0; offset < profileIds.length; offset += 250) {
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) break
    budget.subrequestsUsed += 1
    const { data, error } = await supabase
      .from('profiles')
      .select(columns)
      .in('id', profileIds.slice(offset, offset + 250))
      .limit(250)
    if (error) throw error
    profiles.push(...((data ?? []) as unknown as MatchableProfile[]))
  }
  return profiles
}

async function loadRecentlyVerifiedScholarships(
  supabase: SupabaseClient,
  budget: CampaignBudgetDiagnostic,
): Promise<PushScholarship[]> {
  const cutoff = new Date(Date.now() - MATCH_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const today = todayUtcIso()
  if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return []
  budget.subrequestsUsed += 1
  const { data, error } = await supabase
    .from('scholarships')
    .select('id,title,provider_name,description,amount,deadline,opens_at,how_to_apply,level,discipline,verified,awards_available,estimated_applicant_pool,competitiveness_tier,historical_acceptance_rate,last_verified_at')
    .eq('verified', true)
    .in('level', ['undergrad', 'both'])
    .gte('last_verified_at', cutoff)
    .or(`deadline.is.null,deadline.gte.${today}`)
    .or(`opens_at.is.null,opens_at.lte.${today}`)
    .or(`last_cycle_closed_at.is.null,last_cycle_closed_at.gt.${today}`)
    .order('last_verified_at', { ascending: false })
    .limit(MAX_RECENT_SCHOLARSHIPS)
  if (error) throw error
  return (data ?? []) as unknown as PushScholarship[]
}

async function loadRulesByScholarship(
  supabase: SupabaseClient,
  scholarships: PushScholarship[],
  budget: CampaignBudgetDiagnostic,
): Promise<Map<string, ScholarshipRule[]>> {
  const rulesByScholarship = new Map<string, ScholarshipRule[]>()
  if (scholarships.length === 0) return rulesByScholarship

  for (let offset = 0; offset < scholarships.length; offset += 250) {
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) break
    budget.subrequestsUsed += 1
    const ids = scholarships.slice(offset, offset + 250).map((row) => row.id)
    const { data, error } = await supabase
      .from('scholarship_rules')
      .select('id,scholarship_id,field,operator,value')
      .in('scholarship_id', ids)
      .limit(5000)
    if (error) throw error
    for (const row of (data ?? []) as unknown as ScholarshipRule[]) {
      const current = rulesByScholarship.get(row.scholarship_id) ?? []
      current.push(row)
      rulesByScholarship.set(row.scholarship_id, current)
    }
  }
  return rulesByScholarship
}

function makeCandidate(profileId: string, scholarshipId: string, title: string, deadline: string | null): CandidateAlert {
  return { profileId, scholarshipId, title, deadline, daysUntil: daysUntil(deadline), dedupeKey: `push:new_match:${profileId}:${scholarshipId}` }
}

function cleanTitle(title: string): string {
  return title.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'this scholarship'
}

function batchMessage(alerts: ClaimedAlert[]): { title: string; body: string; data: Record<string, string> } {
  const first = alerts[0]
  const count = alerts.length
  const scholarshipTitle = cleanTitle(first.title)
  return {
    title: count === 1 ? 'A new scholarship match' : `${count} new scholarship matches`,
    body: count === 1
      ? `${scholarshipTitle} may fit your profile. View your new match in Scholars.`
      : `${count} newly verified scholarships may fit your profile. View your fresh matches in Scholars.`,
    data: { url: '/dashboard/fresh-matches' },
  }
}

async function ensureInboxNotification(
  supabase: SupabaseClient,
  alert: ClaimedAlert,
  budget: CampaignBudgetDiagnostic,
): Promise<void> {
  if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return
  budget.subrequestsUsed += 1
  const { data: existing, error: lookupError } = await supabase
    .from('notifications')
    .select('id')
    .eq('profile_id', alert.profileId)
    .eq('scholarship_id', alert.scholarshipId)
    .eq('type', 'new_match')
    .contains('metadata', { dedupe_key: alert.dedupeKey })
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing) return

  if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return
  budget.subrequestsUsed += 1
  const { error } = await supabase.from('notifications').insert({
    profile_id: alert.profileId,
    scholarship_id: alert.scholarshipId,
    type: 'new_match',
    metadata: {
      title: cleanTitle(alert.title),
      deadline: alert.deadline,
      days_until: alert.daysUntil,
      dedupe_key: alert.dedupeKey,
    },
  })
  if (error) throw error
}

async function suppressDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  reason: string,
  budget: CampaignBudgetDiagnostic,
): Promise<void> {
  if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return
  budget.subrequestsUsed += 1
  const { error } = await supabase
    .from('notification_deliveries')
    .update({ status: 'suppressed', lease_until: null, last_error: { message: reason } })
    .eq('id', deliveryId)
    .in('status', ['pending', 'retryable', 'leased'])
  if (error) throw error
}

async function deliverAlertBatch(
  supabase: SupabaseClient,
  alerts: ClaimedAlert[],
  budget: CampaignBudgetDiagnostic,
): Promise<DeliveryOutcome> {
  if (alerts.length === 0) return 'suppressed'
  try {
    await Promise.all(alerts.map((alert) => ensureInboxNotification(supabase, alert, budget)))
    const message = batchMessage(alerts)
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return 'retryable'
    const result = await sendPushForProfile(supabase, alerts[0].profileId, message, {}, budget)

    if (result.accepted > 0) {
      if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return 'retryable'
      budget.subrequestsUsed += alerts.length
      await Promise.all(alerts.map((alert) => markNotificationAccepted(supabase, alert.deliveryId)))
      return 'accepted'
    }
    if (result.targets === 0 && result.failed === 0) {
      await Promise.all(alerts.map((alert) => suppressDelivery(supabase, alert.deliveryId, 'No active push device was available.', budget)))
      return 'suppressed'
    }

    const deliveryError = new Error('No push provider accepted the notification.')
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return 'retryable'
    budget.subrequestsUsed += alerts.length
    await Promise.all(alerts.map((alert) => markNotificationRetryable(supabase, alert.deliveryId, deliveryError)))
    return 'retryable'
  } catch (error) {
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return 'retryable'
    budget.subrequestsUsed += alerts.length
    await Promise.allSettled(alerts.map((alert) => markNotificationRetryable(supabase, alert.deliveryId, error)))
    console.warn('[PushCampaign] Alert batch failed', {
      profileId: alerts[0].profileId,
      count: alerts.length,
      ...getSafePushErrorDiagnostic(error),
    })
    return 'retryable'
  }
}

type QueueResult = { accepted: number; suppressed: number; retryable: number; truncated: boolean }

async function queueAndDeliverGroups(
  supabase: SupabaseClient,
  groups: Map<string, CandidateAlert[]>,
  counters: ScheduledPushCampaignResult,
  budget: CampaignBudgetDiagnostic,
): Promise<QueueResult> {
  const entries = Array.from(groups.entries())
  let accepted = 0
  let suppressed = 0
  let retryable = 0
  let truncated = false

  for (let offset = 0; offset < entries.length; offset += MAX_GROUP_CONCURRENCY) {
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) {
      truncated = true
      break
    }
    const batch = entries.slice(offset, offset + MAX_GROUP_CONCURRENCY)
    const outcomes = await Promise.all(batch.map(async ([profileId, candidates]) => {
      const claimed: ClaimedAlert[] = []
      for (const candidate of candidates) {
        if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) {
          truncated = true
          break
        }
        try {
          budget.subrequestsUsed += 1
          const delivery = await ensureNotificationDelivery(supabase, {
            profileId: candidate.profileId,
            scholarshipId: candidate.scholarshipId,
            campaignKey: 'new_match',
            channel: 'push',
            scheduleBucket: 'newly-verified-scholarship-match',
            dedupeKey: candidate.dedupeKey,
            templateVersion: 'push-new_match-v1',
          })
          if (!delivery) continue
          budget.subrequestsUsed += 1
          const claim = await claimNotificationDeliveryById(supabase, delivery.id, candidate.dedupeKey)
          if (claim) claimed.push({ ...candidate, deliveryId: claim.id })
        } catch (error) {
          console.warn('[PushCampaign] Could not queue an alert', {
            profileId,
            ...getSafePushErrorDiagnostic(error),
          })
        }
      }
      if (claimed.length === 0) return { outcome: null as DeliveryOutcome | null }
      return { outcome: await deliverAlertBatch(supabase, claimed, budget) }
    }))

    for (const { outcome } of outcomes) {
      if (outcome === 'accepted') { counters.newMatchPushesAccepted += 1; accepted += 1 }
      else if (outcome === 'suppressed') { counters.suppressedDeliveries += 1; suppressed += 1 }
      else if (outcome === 'retryable') { counters.retryableDeliveries += 1; retryable += 1 }
    }
  }

  return { accepted, suppressed, retryable, truncated }
}

async function recentMatchGroups(
  supabase: SupabaseClient,
  activeProfileIds: string[],
  budget: CampaignBudgetDiagnostic,
): Promise<Map<string, CandidateAlert[]>> {
  const groups = new Map<string, CandidateAlert[]>()
  if (activeProfileIds.length === 0) return groups
  const [profiles, scholarships] = await Promise.all([
    loadMatchableProfiles(supabase, activeProfileIds, budget),
    loadRecentlyVerifiedScholarships(supabase, budget),
  ])
  if (profiles.length === 0 || scholarships.length === 0) return groups
  const rulesByScholarship = await loadRulesByScholarship(supabase, scholarships, budget)

  for (const sourceProfile of profiles) {
    const profile = toMatchableProfile(sourceProfile)
    const matches = rankScholarships(profile, scholarships, rulesByScholarship)
      .filter((match) => match.tier !== 'unlikely')
      .slice(0, MAX_MATCHES_PER_PROFILE)
    for (const match of matches) {
      const candidate = makeCandidate(sourceProfile.id, match.id, match.title, match.deadline)
      const current = groups.get(sourceProfile.id) ?? []
      current.push(candidate)
      groups.set(sourceProfile.id, current)
    }
  }
  return groups
}

async function pendingPushDeliveryRows(
  supabase: SupabaseClient,
  budget: CampaignBudgetDiagnostic,
): Promise<RetryRow[]> {
  if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) return []
  budget.subrequestsUsed += 1
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select('id,profile_id,scholarship_id,dedupe_key')
    .eq('channel', 'push')
    .eq('campaign_key', 'new_match')
    .in('status', ['pending', 'retryable', 'leased'])
    .lte('available_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(RETRY_BATCH_LIMIT)
  if (error) throw error
  return (data ?? []) as RetryRow[]
}

async function retryQueuedAlerts(
  supabase: SupabaseClient,
  activeProfileIds: Set<string>,
  counters: ScheduledPushCampaignResult,
  budget: CampaignBudgetDiagnostic,
): Promise<{ processed: number; truncated: boolean }> {
  const rows = await pendingPushDeliveryRows(supabase, budget)
  if (rows.length === 0) return { processed: 0, truncated: false }

  const scholarshipIds = Array.from(new Set(rows.flatMap((row) => row.scholarship_id ? [row.scholarship_id] : [])))
  const scholarshipsById = new Map<string, { id: string; title: string; deadline: string | null; verified: boolean; last_verified_at: string | null }>()
  for (let offset = 0; offset < scholarshipIds.length; offset += 250) {
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) break
    budget.subrequestsUsed += 1
    const { data, error } = await supabase
      .from('scholarships')
      .select('id,title,deadline,verified,last_verified_at')
      .in('id', scholarshipIds.slice(offset, offset + 250))
      .limit(250)
    if (error) throw error
    for (const scholarship of data ?? []) {
      scholarshipsById.set(scholarship.id as string, scholarship as unknown as { id: string; title: string; deadline: string | null; verified: boolean; last_verified_at: string | null })
    }
  }

  const groups = new Map<string, CandidateAlert[]>()
  const groupedDeliveryIds = new Map<string, string[]>()
  const cutoff = Date.now() - MAX_RETRY_AGE_DAYS * 24 * 60 * 60 * 1000

  for (const row of rows) {
    if (!row.scholarship_id) {
      await suppressDelivery(supabase, row.id, 'The scholarship linked to this push was removed.', budget)
      counters.suppressedDeliveries += 1
      continue
    }
    if (!activeProfileIds.has(row.profile_id)) {
      await suppressDelivery(supabase, row.id, 'The account has no active push device.', budget)
      counters.suppressedDeliveries += 1
      continue
    }

    const scholarship = scholarshipsById.get(row.scholarship_id)
    if (!scholarship || !scholarship.verified) {
      await suppressDelivery(supabase, row.id, 'The scholarship is no longer available.', budget)
      counters.suppressedDeliveries += 1
      continue
    }
    if (!scholarship.last_verified_at || new Date(scholarship.last_verified_at).getTime() < cutoff) {
      await suppressDelivery(supabase, row.id, 'The new-match alert is outside the freshness window.', budget)
      counters.suppressedDeliveries += 1
      continue
    }

    try {
      if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) break
      budget.subrequestsUsed += 1
      const claim = await claimNotificationDeliveryById(supabase, row.id, row.dedupe_key)
      if (!claim) continue
      const candidate = makeCandidate(row.profile_id, row.scholarship_id, scholarship.title, scholarship.deadline)
      candidate.dedupeKey = row.dedupe_key
      const groupKey = row.profile_id
      const current = groups.get(groupKey) ?? []
      current.push({ ...candidate, dedupeKey: claim.dedupeKey })
      groups.set(groupKey, current)
      const deliveryIds = groupedDeliveryIds.get(groupKey) ?? []
      deliveryIds.push(claim.id)
      groupedDeliveryIds.set(groupKey, deliveryIds)
    } catch (error) {
      console.warn('[PushCampaign] Could not claim a retry', {
        profileId: row.profile_id,
        ...getSafePushErrorDiagnostic(error),
      })
    }
  }

  const entries = Array.from(groups.entries())
  let processed = 0
  let truncated = false

  for (let offset = 0; offset < entries.length; offset += MAX_GROUP_CONCURRENCY) {
    if (budget.subrequestsUsed >= SUBREQUEST_BUDGET) {
      truncated = true
      break
    }
    const batch = entries.slice(offset, offset + MAX_GROUP_CONCURRENCY)
    const outcomes = await Promise.all(batch.map(async ([groupKey, candidates]) => {
      const outcome = await deliverAlertBatch(supabase, candidates.map((candidate, index) => ({
        ...candidate,
        deliveryId: groupedDeliveryIds.get(groupKey)?.[index] ?? '',
      })).filter((candidate) => candidate.deliveryId), budget);
      return outcome
    }))
    processed += 1
    for (const outcome of outcomes) {
      if (outcome === 'accepted') counters.retryPushesAccepted += 1
      else if (outcome === 'suppressed') counters.suppressedDeliveries += 1
      else counters.retryableDeliveries += 1
    }
  }

  return { processed, truncated }
}

/** Daily notifications for newly verified scholarship matches, bounded by subrequest budget. */
export async function runDailyPushCampaign(supabase: SupabaseClient): Promise<ScheduledPushCampaignResult & CampaignBudgetDiagnostic> {
  const counters: ScheduledPushCampaignResult = {
    activeProfiles: 0,
    profilesCheckedForMatches: 0,
    newMatchPushesAccepted: 0,
    retryPushesAccepted: 0,
    suppressedDeliveries: 0,
    retryableDeliveries: 0,
    more: false,
  }

  const budget: CampaignBudgetDiagnostic = {
    subrequestsUsed: 0,
    subrequestBudget: SUBREQUEST_BUDGET,
    budgetExhausted: false,
    truncatedBatches: 0,
  }

  const activeProfileIds = await loadActivePushProfileIds(supabase, budget)
  const activeProfiles = new Set(activeProfileIds)
  counters.activeProfiles = activeProfileIds.length
  if (activeProfileIds.length === 0) {
    budget.budgetExhausted = budget.subrequestsUsed >= SUBREQUEST_BUDGET
    return { ...counters, ...budget }
  }

  const matchGroups = await recentMatchGroups(supabase, activeProfileIds, budget)
  counters.profilesCheckedForMatches = activeProfileIds.length

  const newMatchResult = await queueAndDeliverGroups(supabase, matchGroups, counters, budget)
  const retryResult = await retryQueuedAlerts(supabase, activeProfiles, counters, budget)

  budget.truncatedBatches = (newMatchResult.truncated ? 1 : 0) + (retryResult.truncated ? 1 : 0)
  budget.budgetExhausted = budget.subrequestsUsed >= SUBREQUEST_BUDGET
  counters.more = budget.budgetExhausted || newMatchResult.truncated || retryResult.truncated

  return { ...counters, ...budget }
}
