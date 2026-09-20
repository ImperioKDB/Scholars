import type { SupabaseClient } from '@supabase/supabase-js'
import { inngest, DEADLINE_REMINDER_EVENT } from '@/lib/inngest/client'
import { ensureNotificationDelivery } from './outbox'

export type DeadlineReminderCandidate = {
  profileId: string
  scholarshipId: string
  alreadyReminded: boolean
}

export async function queueDeadlineReminder(
  supabase: SupabaseClient,
  candidate: DeadlineReminderCandidate,
): Promise<'queued' | 'skipped'> {
  const dedupeKey = `deadline_reminder:${candidate.profileId}:${candidate.scholarshipId}`
  const delivery = await ensureNotificationDelivery(supabase, {
    profileId: candidate.profileId,
    scholarshipId: candidate.scholarshipId,
    campaignKey: 'deadline_reminder',
    scheduleBucket: 'saved-scholarship-deadline',
    dedupeKey,
    templateVersion: 'deadline-reminder-v1',
  })

  if (!delivery || candidate.alreadyReminded || !['pending', 'retryable'].includes(delivery.status)) {
    return 'skipped'
  }

  const eventId = `notification:${delivery.id}`
  await inngest.send({
    name: DEADLINE_REMINDER_EVENT,
    id: eventId,
    data: {
      deliveryId: delivery.id,
      correlationId: eventId,
    },
  })
  return 'queued'
}
