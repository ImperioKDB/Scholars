import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'scholars',
})

export const PROFILE_NUDGE_EVENT = 'notification/profile-nudge.requested' as const
export const DEADLINE_REMINDER_EVENT = 'notification/deadline-reminder.requested' as const

export type ProfileNudgeEvent = {
  name: typeof PROFILE_NUDGE_EVENT
  data: {
    deliveryId: string
    correlationId: string
  }
}

export type DeadlineReminderEvent = {
  name: typeof DEADLINE_REMINDER_EVENT
  data: {
    deliveryId: string
    correlationId: string
  }
}
