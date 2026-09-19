import { createServiceClient } from '@/lib/supabase/service'
import { ensureNotificationDelivery } from './outbox'
import { inngest, PROFILE_NUDGE_EVENT } from '@/lib/inngest/client'
import { PROFILE_NUDGE_INTERVAL_MS, PROFILE_NUDGE_MAX_SENDS, PROFILE_NUDGE_BATCH, PROFILE_NUDGE_FORCE_BATCH } from './profileNudges'

export type QueuedProfileNudgeSummary = {
  students_queued: number
  failed: number
  skipped_missing_columns: boolean
  outside_send_window: boolean
  first_error: string | null
}

type ProfileRow = {
  id: string
  profile_completeness: number
  profile_reminder_count: number | null
  profile_reminder_last_sent_at: string | null
}

function inLagosSendWindow(now: Date): boolean {
  const hourWAT = (now.getUTCHours() + 1) % 24
  return hourWAT >= 7 && hourWAT < 20
}

function lastSentMs(profile: ProfileRow): number {
  if (profile.profile_reminder_last_sent_at == null) return -1
  const timestamp = Date.parse(profile.profile_reminder_last_sent_at)
  return Number.isNaN(timestamp) ? -1 : timestamp
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return String(error)
}

export async function queueProfileNudges(
  opts: { minIntervalMs?: number; enforceSendWindow?: boolean; ignoreCap?: boolean } = {},
): Promise<QueuedProfileNudgeSummary> {
  const minIntervalMs = opts.minIntervalMs ?? PROFILE_NUDGE_INTERVAL_MS
  const enforceSendWindow = opts.enforceSendWindow ?? false
  const ignoreCap = opts.ignoreCap ?? false
  const summary: QueuedProfileNudgeSummary = {
    students_queued: 0,
    failed: 0,
    skipped_missing_columns: false,
    outside_send_window: false,
    first_error: null,
  }

  if (enforceSendWindow && !inLagosSendWindow(new Date())) {
    summary.outside_send_window = true
    return summary
  }

  const supabase = createServiceClient()
  try {
    const probe = await supabase
      .from('profiles')
      .select('id,profile_reminder_last_sent_at,profile_reminder_count')
      .limit(1)
    if (probe.error) {
      summary.skipped_missing_columns = true
      return summary
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id,profile_completeness,profile_reminder_count,profile_reminder_last_sent_at')
      .lt('profile_completeness', 100)
    if (error) throw error

    const cutoffMs = Date.now() - minIntervalMs
    const eligible = ((data ?? []) as ProfileRow[])
      .filter((profile) => ignoreCap || (profile.profile_reminder_count ?? 0) < PROFILE_NUDGE_MAX_SENDS)
      .filter((profile) => lastSentMs(profile) < cutoffMs)
      .sort((left, right) => lastSentMs(left) - lastSentMs(right))
      .slice(0, ignoreCap ? PROFILE_NUDGE_FORCE_BATCH : PROFILE_NUDGE_BATCH)

    for (const profile of eligible) {
      const nextReminderNumber = (profile.profile_reminder_count ?? 0) + 1
      const dedupeKey = `profile_nudge:${profile.id}:${nextReminderNumber}`
      try {
        const delivery = await ensureNotificationDelivery(supabase, {
          profileId: profile.id,
          campaignKey: 'profile_nudge',
          scheduleBucket: `reminder-${nextReminderNumber}`,
          dedupeKey,
          templateVersion: 'profile-nudge-v1',
        })
        if (!delivery || !['pending', 'retryable'].includes(delivery.status)) continue
        await inngest.send({
          name: PROFILE_NUDGE_EVENT,
          id: `notification:${delivery.id}`,
          data: { deliveryId: delivery.id, correlationId: delivery.id },
        })
        summary.students_queued += 1
      } catch (error) {
        summary.failed += 1
        if (!summary.first_error) summary.first_error = errorText(error)
      }
    }
  } catch (error) {
    summary.failed += 1
    summary.first_error = errorText(error)
  }

  return summary
}
