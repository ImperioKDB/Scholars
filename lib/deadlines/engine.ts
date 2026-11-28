import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushForProfile } from '@/lib/push/deliver'
import { getDeadlineEmailConfig, sendDeadlineEmail } from './mailtrap'
import { deadlineClosesAt, deadlineListingPath, deadlineMessage, type DeadlineListing } from './policy'

type Channel = 'email' | 'push'
type ClaimedListing = DeadlineListing & {
  id: string
  profile_id: string
  full_name: string | null
  email: string | null
  attempts: number
  lease_until: string
}
type Outcome = 'accepted' | 'retryable' | 'failed' | 'suppressed' | 'unknown' | 'dead_letter'
type DeliveryResult = { status: Outcome; code?: string; messageId?: string | null; retryAt?: string }

const batchLimits = { email: 10, push: 3 }
const concurrency = { email: 2, push: 2 }

function integerSetting(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback
}

function policy() {
  const early = integerSetting('DEADLINE_REMINDER_DAYS', 7, 2, 30)
  return {
    p_early: early,
    p_push: integerSetting('DEADLINE_PUSH_REMINDER_DAYS', Math.min(3, early - 1), 1, early - 1),
  }
}

export function deadlineEmailLimits() {
  return {
    daily: integerSetting('DEADLINE_EMAIL_DAILY_LIMIT', 140, 0, 150),
    monthly: integerSetting('DEADLINE_EMAIL_MONTHLY_LIMIT', 3800, 0, 4000),
  }
}

export async function prepareDeadlineReminders(service: SupabaseClient) {
  const emailEnabled = process.env.DEADLINE_EMAIL_ENABLED === 'true'
  const emailConfigured = emailEnabled && getDeadlineEmailConfig() !== null
  const { data, error } = await service.rpc('prepare_deadline_reminders', {
    ...policy(),
    p_email: emailConfigured,
    p_passed_email: process.env.DEADLINE_PASSED_EMAIL_ENABLED === 'true',
  })
  if (error) throw error
  return { ...data, emailEnabled, emailConfigured }
}

export async function getDeadlineBacklog(service: SupabaseClient) {
  const { data, error } = await service.rpc('deadline_reminder_backlog', {
    ...policy(),
    p_email: process.env.DEADLINE_EMAIL_ENABLED === 'true' && getDeadlineEmailConfig() !== null,
  })
  if (error) throw error
  const { daily, monthly } = deadlineEmailLimits()
  return {
    ...data,
    emailQuotaReached: data.dailyEmailAttempts >= daily || data.monthlyEmailAttempts >= monthly,
  }
}

async function sendPush(service: SupabaseClient, bundle: ClaimedListing[]): Promise<DeliveryResult> {
  const first = bundle[0]
  const cutoff = Math.min(...bundle.map((row) => deadlineClosesAt(row.deadline_date)))
  const ttl = Math.min(3600, Math.floor((cutoff - Date.now()) / 1000))
  if (ttl <= 0) return { status: 'suppressed', code: 'deadline_passed_before_push' }
  const title = first.title.replace(/\s+/g, ' ').trim().slice(0, 120)
  const result = await sendPushForProfile(service, first.profile_id, {
    title: 'Scholarship and opportunity deadlines',
    body: bundle.length === 1
      ? deadlineMessage(first.deadline_stage, title) ?? 'Open Scholars for deadline details.'
      : `${bundle.length} application deadlines are approaching. Open Scholars to plan ahead.`,
    data: { url: bundle.length === 1 ? deadlineListingPath(first) : '/applications' },
  }, { deviceLimit: 5, ttl })
  if (result.accepted > 0) return { status: 'accepted' }
  if (result.retryable > 0) return { status: 'retryable', code: 'push_temporary_failure' }
  if (result.accepted === 0 && result.failed === result.expired && result.targets === result.expired) {
    return { status: 'suppressed', code: 'push_no_active_device' }
  }
  return { status: 'failed', code: 'push_rejected' }
}

async function recordOutcome(service: SupabaseClient, bundle: ClaimedListing[], result: DeliveryResult) {
  // An old worker must not overwrite a newer push lease after resuming.
  const outcomes = new Map<Outcome, ClaimedListing[]>()
  for (const row of bundle) {
    const status = result.status === 'retryable' && row.attempts >= 3 ? 'dead_letter' : result.status
    outcomes.set(status, [...(outcomes.get(status) ?? []), row])
  }

  for (const [status, rows] of outcomes) {
    const now = new Date()
    const retryTime = Math.max(now.getTime() + 20 * 60_000, Date.parse(result.retryAt ?? '') || 0)
    const { data, error } = await service.from('notification_deliveries').update({
      status,
      lease_until: null,
      ...(status === 'accepted' ? { sent_at: now.toISOString(), provider_message_id: result.messageId ?? null } : {}),
      ...(status === 'retryable' ? { available_at: new Date(retryTime).toISOString() } : {}),
      last_error: result.code ? { code: result.code } : null,
    }).in('id', rows.map((row) => row.id))
      .eq('status', 'leased').eq('lease_until', rows[0].lease_until).select('id')
    if (error) throw error
    const persisted = new Set((data ?? []).map((row) => row.id))
    outcomes.set(status, rows.filter((row) => persisted.has(row.id)))
  }
  return outcomes
}

export async function deliverDeadlineReminders(service: SupabaseClient, channel: Channel) {
  const summary = {
    processed: 0, accepted: 0, retryable: 0, failed: 0, suppressed: 0, unknown: 0, dead_letter: 0,
    more: false,
  }
  const emailConfig = channel === 'email' && process.env.DEADLINE_EMAIL_ENABLED === 'true'
    ? getDeadlineEmailConfig()
    : null
  if (channel === 'email' && !emailConfig) return summary

  const { daily, monthly } = deadlineEmailLimits()
  for (let offset = 0; offset < batchLimits[channel]; offset += concurrency[channel]) {
    const outcomes = await Promise.allSettled(Array.from({ length: Math.min(concurrency[channel], batchLimits[channel] - offset) }, async () => {
      const { data, error } = await service.rpc('claim_deadline_reminders', {
        ...policy(),
        p_channel: channel,
        p_passed_email: process.env.DEADLINE_PASSED_EMAIL_ENABLED === 'true',
        p_daily_limit: daily,
        p_monthly_limit: monthly,
      })
      if (error) throw error
      const bundle = (data ?? []) as ClaimedListing[]
      if (bundle.length === 0) return false
      const result = emailConfig
        ? await sendDeadlineEmail(emailConfig, bundle[0].email!, bundle[0].full_name, bundle)
        : await sendPush(service, bundle)
      const results = await recordOutcome(service, bundle, result)
      for (const [status, rows] of results) summary[status] += rows.length
      summary.processed += 1
      return true
    }))

    const failure = outcomes.find((outcome) => outcome.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
    if (outcomes.every((outcome) => outcome.status === 'fulfilled' && !outcome.value)) break
  }
  summary.more = summary.processed === batchLimits[channel]
  return summary
}
