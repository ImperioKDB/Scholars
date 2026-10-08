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

const PAGE_SIZE = 500
const MAX_DEVICE_ROWS_PER_CHANNEL = 10_000
const MAX_ACTIVE_PROFILES = 2_000
const MAX_RECENT_SCHOLARSHIPS = 250
const MAX_MATCHES_PER_PROFILE = 5
const MATCH_LOOKBACK_HOURS = 48
const MAX_GROUP_CONCURRENCY = 8
const RETRY_BATCH_LIMIT = 500
const MAX_RETRY_AGE_DAYS = 7

export type ScheduledPushCampaignResult = {
  activeProfiles: number
  profilesCheckedForMatches: number
  newMatchPushesAccepted: number
  deadlinePushesAccepted: number
  retryPushesAccepted: number
  suppressedDeliveries: number
  retryableDeliveries: number
}

type AlertType = 'new_match' | 'deadline_reminder'
type CandidateAlert = {
  profileId: string
  scholarshipId: string
  type: AlertType
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
  campaign_key: string
  dedupe_key: string
}
type DeliveryOutcome = 'accepted' | 'suppressed' | 'retryable'

function utcDatePlusDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function deadlineReminderDays(): number {
  const configured = Number.parseInt(process.env.DEADLINE_REMINDER_DAYS ?? '7', 10)
  return Number.isInteger(configured) && configured >= 1 && configured <= 30 ? configured : 7
}

async function loadActivePushProfileIds(supabase: SupabaseClient): Promise<string[]> {
  const profileIds = new Set<string>()
  const sources = ['push_tokens', 'web_push_subscriptions'] as const

  await Promise.all(sources.map(async (table) => {
    for (let offset = 0; offset < MAX_DEVICE_ROWS_PER_CHANNEL; offset += PAGE_SIZE) {
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
): Promise<MatchableProfile[]> {
  const profiles: MatchableProfile[] = []
  const columns = [
    'id', 'discipline', 'gpa', 'nationality', 'gender', 'financial_need',
    'date_of_birth', 'state_of_origin', 'lga_of_origin', 'year_of_study',
    'institution_type', 'jamb_score', 'waec_credit_count',
    'has_english_maths_credit', 'disability_status', 'profile_completeness',
  ].join(',')

  for (let offset = 0; offset < profileIds.length; offset += 250) {
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

async function loadRecentlyVerifiedScholarships(supabase: SupabaseClient): Promise<PushScholarship[]> {
  const cutoff = new Date(Date.now() - MATCH_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const today = todayUtcIso()
  const { data, error } = await supabase
    .from('scholarships')
    .select('id,title,provider_name,description,amount,deadline,opens_at,last_cycle_closed_at,application_url,how_to_apply,level,discipline,verified,awards_available,estimated_applicant_pool,competitiveness_tier,historical_acceptance_rate,last_verified_at')
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
): Promise<Map<string, ScholarshipRule[]>> {
  const rulesByScholarship = new Map<string, ScholarshipRule[]>()
  if (scholarships.length === 0) return rulesByScholarship

  for (let offset = 0; offset < scholarships.length; offset += 250) {
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

function groupByProfile(alerts: CandidateAlert[]): Map<string, CandidateAlert[]> {
  const groups = new Map<string, CandidateAlert[]>()
  for (const alert of alerts) {
    const current = groups.get(alert.profileId) ?? []
    current.push(alert)
    groups.set(alert.profileId, current)
  }
  return groups
}

function makeCandidate(
  profileId: string,
  scholarshipId: string,
  type: AlertType,
  title: string,
  deadline: string | null,
): CandidateAlert {
  const days = deadline ? daysUntil(deadline) : null
  const dedupeKey = type === 'new_match'
    ? `push:new_match:${profileId}:${scholarshipId}`
    : `push:deadline_reminder:${profileId}:${scholarshipId}:${deadline ?? 'unknown'}`
  return { profileId, scholarshipId, type, title, deadline, daysUntil: days, dedupeKey }
}

async function loadDeadlineCandidates(
  supabase: SupabaseClient,
  activeProfileIds: Set<string>,
): Promise<CandidateAlert[]> {
  const days = deadlineReminderDays()
  const deadlineDate = utcDatePlusDays(todayUtcIso(), days)
  const { data: dueScholarships, error: scholarshipsError } = await supabase
    .from('scholarships')
    .select('id,title,deadline')
    .eq('verified', true)
    .eq('deadline', deadlineDate)
    .order('title', { ascending: true })
    .limit(500)
  if (scholarshipsError) throw scholarshipsError
  if (!dueScholarships?.length) return []

  const dueById = new Map<string, { title: string; deadline: string }>(
    dueScholarships.map((row) => [row.id as string, { title: row.title as string, deadline: row.deadline as string }]),
  )
  const scholarshipIds = Array.from(dueById.keys())
  const alerts: CandidateAlert[] = []

  for (let scholarshipOffset = 0; scholarshipOffset < scholarshipIds.length; scholarshipOffset += 100) {
    const batchIds = scholarshipIds.slice(scholarshipOffset, scholarshipOffset + 100)
    for (let offset = 0; offset < MAX_DEVICE_ROWS_PER_CHANNEL; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('saved_scholarships')
        .select('id,profile_id,scholarship_id')
        .in('scholarship_id', batchIds)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      for (const saved of data ?? []) {
        const profileId = saved.profile_id as string
        const scholarshipId = saved.scholarship_id as string
        const scholarship = dueById.get(scholarshipId)
        if (!scholarship || !activeProfileIds.has(profileId)) continue
        alerts.push(makeCandidate(profileId, scholarshipId, 'deadline_reminder', scholarship.title, scholarship.deadline))
      }
      if (!data || data.length < PAGE_SIZE) break
    }
  }
  return alerts
}

function cleanTitle(title: string): string {
  return title.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'this scholarship'
}

function batchMessage(alerts: ClaimedAlert[]): { title: string; body: string; data: Record<string, string> } {
  const first = alerts[0]
  const count = alerts.length
  const scholarshipTitle = cleanTitle(first.title)
  if (first.type === 'new_match') {
    return {
      title: count === 1 ? 'A new scholarship match' : `${count} new scholarship matches`,
      body: count === 1
        ? `${scholarshipTitle} may fit your profile. View your new match in Scholars.`
        : `${count} newly verified scholarships may fit your profile. View your fresh matches in Scholars.`,
      data: { url: '/dashboard/fresh-matches' },
    }
  }

  const days = first.daysUntil
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days !== null && days > 1 ? `in ${days} days` : 'soon'
  return {
    title: count === 1 ? 'A saved scholarship deadline is coming up' : `${count} saved deadlines are coming up`,
    body: count === 1
      ? `${scholarshipTitle} is due ${when}. Open Scholars to plan ahead.`
      : `${count} of your saved scholarships are due ${when}. Open Scholars to plan ahead.`,
    data: { url: `/scholarships/${first.scholarshipId}` },
  }
}

async function ensureInboxNotification(supabase: SupabaseClient, alert: ClaimedAlert): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from('notifications')
    .select('id')
    .eq('profile_id', alert.profileId)
    .eq('scholarship_id', alert.scholarshipId)
    .eq('type', alert.type)
    .contains('metadata', { dedupe_key: alert.dedupeKey })
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing) return

  const { error } = await supabase.from('notifications').insert({
    profile_id: alert.profileId,
    scholarship_id: alert.scholarshipId,
    type: alert.type,
    metadata: {
      title: cleanTitle(alert.title),
      deadline: alert.deadline,
      days_until: alert.daysUntil,
      dedupe_key: alert.dedupeKey,
    },
  })
  if (error) throw error
}

async function suppressDelivery(supabase: SupabaseClient, deliveryId: string, reason: string): Promise<void> {
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
): Promise<DeliveryOutcome> {
  if (alerts.length === 0) return 'suppressed'
  try {
    await Promise.all(alerts.map((alert) => ensureInboxNotification(supabase, alert)))
    const message = batchMessage(alerts)
    const result = await sendPushForProfile(supabase, alerts[0].profileId, message)

    if (result.accepted > 0) {
      await Promise.all(alerts.map((alert) => markNotificationAccepted(supabase, alert.deliveryId)))
      return 'accepted'
    }
    if (result.targets === 0 && result.failed === 0) {
      await Promise.all(alerts.map((alert) => suppressDelivery(supabase, alert.deliveryId, 'No active push device was available.')))
      return 'suppressed'
    }

    const deliveryError = new Error('No push provider accepted the notification.')
    await Promise.all(alerts.map((alert) => markNotificationRetryable(supabase, alert.deliveryId, deliveryError)))
    return 'retryable'
  } catch (error) {
    await Promise.allSettled(alerts.map((alert) => markNotificationRetryable(supabase, alert.deliveryId, error)))
    console.warn('[PushCampaign] Alert batch failed', {
      profileId: alerts[0].profileId,
      type: alerts[0].type,
      count: alerts.length,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return 'retryable'
  }
}

async function queueAndDeliverGroups(
  supabase: SupabaseClient,
  groups: Map<string, CandidateAlert[]>,
  counters: ScheduledPushCampaignResult,
  counterKey: 'newMatchPushesAccepted' | 'deadlinePushesAccepted' | 'retryPushesAccepted',
): Promise<void> {
  const entries = Array.from(groups.entries())
  for (let offset = 0; offset < entries.length; offset += MAX_GROUP_CONCURRENCY) {
    const batch = entries.slice(offset, offset + MAX_GROUP_CONCURRENCY)
    const outcomes = await Promise.all(batch.map(async ([profileId, candidates]) => {
      const claimed: ClaimedAlert[] = []
      for (const candidate of candidates) {
        try {
          const delivery = await ensureNotificationDelivery(supabase, {
            profileId: candidate.profileId,
            scholarshipId: candidate.scholarshipId,
            campaignKey: candidate.type,
            channel: 'push',
            scheduleBucket: candidate.type === 'deadline_reminder'
              ? `saved-scholarship-deadline:${candidate.deadline ?? 'unknown'}`
              : 'newly-verified-scholarship-match',
            dedupeKey: candidate.dedupeKey,
            templateVersion: `push-${candidate.type}-v1`,
          })
          if (!delivery) continue
          const claim = await claimNotificationDeliveryById(supabase, delivery.id, candidate.dedupeKey)
          if (claim) claimed.push({ ...candidate, deliveryId: claim.id })
        } catch (error) {
          console.warn('[PushCampaign] Could not queue an alert', {
            profileId,
            type: candidate.type,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          })
        }
      }
      if (claimed.length === 0) return { outcome: null as DeliveryOutcome | null }
      return { outcome: await deliverAlertBatch(supabase, claimed) }
    }))

    for (const { outcome } of outcomes) {
      if (outcome === 'accepted') counters[counterKey] += 1
      else if (outcome === 'suppressed') counters.suppressedDeliveries += 1
      else if (outcome === 'retryable') counters.retryableDeliveries += 1
    }
  }
}

async function recentMatchGroups(
  supabase: SupabaseClient,
  activeProfileIds: string[],
): Promise<Map<string, CandidateAlert[]>> {
  const groups = new Map<string, CandidateAlert[]>()
  if (activeProfileIds.length === 0) return groups
  const [profiles, scholarships] = await Promise.all([
    loadMatchableProfiles(supabase, activeProfileIds),
    loadRecentlyVerifiedScholarships(supabase),
  ])
  if (profiles.length === 0 || scholarships.length === 0) return groups
  const rulesByScholarship = await loadRulesByScholarship(supabase, scholarships)

  for (const sourceProfile of profiles) {
    const profile = toMatchableProfile(sourceProfile)
    const matches = rankScholarships(profile, scholarships, rulesByScholarship)
      .filter((match) => match.tier !== 'unlikely')
      .slice(0, MAX_MATCHES_PER_PROFILE)
    for (const match of matches) {
      const candidate = makeCandidate(sourceProfile.id, match.id, 'new_match', match.title, match.deadline)
      const current = groups.get(sourceProfile.id) ?? []
      current.push(candidate)
      groups.set(sourceProfile.id, current)
    }
  }
  return groups
}

async function pendingPushDeliveryRows(supabase: SupabaseClient): Promise<RetryRow[]> {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select('id,profile_id,scholarship_id,campaign_key,dedupe_key')
    .eq('channel', 'push')
    .in('campaign_key', ['new_match', 'deadline_reminder'])
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
): Promise<void> {
  const rows = await pendingPushDeliveryRows(supabase)
  if (rows.length === 0) return

  const scholarshipIds = Array.from(new Set(rows.flatMap((row) => row.scholarship_id ? [row.scholarship_id] : [])))
  const scholarshipsById = new Map<string, { id: string; title: string; deadline: string | null; verified: boolean; last_verified_at: string | null }>()
  for (let offset = 0; offset < scholarshipIds.length; offset += 250) {
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
  const today = todayUtcIso()

  for (const row of rows) {
    if (!row.scholarship_id) {
      await suppressDelivery(supabase, row.id, 'The scholarship linked to this push was removed.')
      counters.suppressedDeliveries += 1
      continue
    }
    if (!activeProfileIds.has(row.profile_id)) {
      await suppressDelivery(supabase, row.id, 'The account has no active push device.')
      counters.suppressedDeliveries += 1
      continue
    }

    const scholarship = scholarshipsById.get(row.scholarship_id)
    const type = row.campaign_key as AlertType
    if (!scholarship || !scholarship.verified) {
      await suppressDelivery(supabase, row.id, 'The scholarship is no longer available.')
      counters.suppressedDeliveries += 1
      continue
    }
    if (type === 'deadline_reminder' && (!scholarship.deadline || scholarship.deadline < today)) {
      await suppressDelivery(supabase, row.id, 'The saved scholarship deadline has passed.')
      counters.suppressedDeliveries += 1
      continue
    }
    if (type === 'new_match' && (!scholarship.last_verified_at || new Date(scholarship.last_verified_at).getTime() < cutoff)) {
      await suppressDelivery(supabase, row.id, 'The new-match alert is outside the freshness window.')
      counters.suppressedDeliveries += 1
      continue
    }

    try {
      const claim = await claimNotificationDeliveryById(supabase, row.id, row.dedupe_key)
      if (!claim) continue
      const candidate = makeCandidate(
        row.profile_id,
        row.scholarship_id,
        type,
        scholarship.title,
        scholarship.deadline,
      )
      candidate.dedupeKey = row.dedupe_key
      const groupKey = `${row.profile_id}:${type}`
      const current = groups.get(groupKey) ?? []
      current.push({ ...candidate, dedupeKey: claim.dedupeKey })
      groups.set(groupKey, current)
      const deliveryIds = groupedDeliveryIds.get(groupKey) ?? []
      deliveryIds.push(claim.id)
      groupedDeliveryIds.set(groupKey, deliveryIds)
    } catch (error) {
      console.warn('[PushCampaign] Could not claim a retry', {
        profileId: row.profile_id,
        type,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }

  const entries = Array.from(groups.entries())
  for (let offset = 0; offset < entries.length; offset += MAX_GROUP_CONCURRENCY) {
    const batch = entries.slice(offset, offset + MAX_GROUP_CONCURRENCY)
    const outcomes = await Promise.all(batch.map(async ([groupKey, candidates]) => {
      const outcome = await deliverAlertBatch(supabase, candidates.map((candidate, index) => ({
        ...candidate,
        deliveryId: groupedDeliveryIds.get(groupKey)?.[index] ?? '',
      })).filter((candidate) => candidate.deliveryId));
      return outcome
    }))
    for (const outcome of outcomes) {
      if (outcome === 'accepted') counters.retryPushesAccepted += 1
      else if (outcome === 'suppressed') counters.suppressedDeliveries += 1
      else counters.retryableDeliveries += 1
    }
  }
}

/** Daily, push-only campaign. Email and Inngest automation remain untouched. */
export async function runDailyPushCampaign(supabase: SupabaseClient): Promise<ScheduledPushCampaignResult> {
  const counters: ScheduledPushCampaignResult = {
    activeProfiles: 0,
    profilesCheckedForMatches: 0,
    newMatchPushesAccepted: 0,
    deadlinePushesAccepted: 0,
    retryPushesAccepted: 0,
    suppressedDeliveries: 0,
    retryableDeliveries: 0,
  }

  const activeProfileIds = await loadActivePushProfileIds(supabase)
  const activeProfiles = new Set(activeProfileIds)
  counters.activeProfiles = activeProfileIds.length
  if (activeProfileIds.length === 0) return counters

  const [matchGroups, deadlineCandidates] = await Promise.all([
    recentMatchGroups(supabase, activeProfileIds),
    loadDeadlineCandidates(supabase, activeProfiles),
  ])
  counters.profilesCheckedForMatches = activeProfileIds.length

  const deadlineGroups = groupByProfile(deadlineCandidates)
  await Promise.all([
    queueAndDeliverGroups(supabase, matchGroups, counters, 'newMatchPushesAccepted'),
    queueAndDeliverGroups(supabase, deadlineGroups, counters, 'deadlinePushesAccepted'),
  ])
  await retryQueuedAlerts(supabase, activeProfiles, counters)
  return counters
}
