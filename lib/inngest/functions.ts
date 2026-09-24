import { DEADLINE_REMINDER_EVENT, PROFILE_NUDGE_EVENT, inngest } from './client'

/**
 * Email automation is paused. These handlers remain registered so stale
 * events fail closed instead of reaching a provider.
 */
export const sendProfileNudge = inngest.createFunction(
  {
    id: 'scholars-send-profile-nudge',
    retries: 0,
    triggers: { event: PROFILE_NUDGE_EVENT },
  },
  async ({ event }) => ({
    skipped: true,
    automaticEmailDisabled: true,
    deliveryId: event.data.deliveryId,
  }),
)

export const sendDeadlineReminder = inngest.createFunction(
  {
    id: 'scholars-send-deadline-reminder',
    retries: 0,
    triggers: { event: DEADLINE_REMINDER_EVENT },
  },
  async ({ event }) => ({
    skipped: true,
    automaticEmailDisabled: true,
    deliveryId: event.data.deliveryId,
  }),
)
