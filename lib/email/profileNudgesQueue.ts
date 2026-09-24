export type QueuedProfileNudgeSummary = {
  students_queued: number
  failed: number
  skipped_missing_columns: boolean
  outside_send_window: boolean
  first_error: string | null
}

/**
 * Automatic profile-nudge queueing is paused. Manual admin sends use
 * runProfileNudges directly so a human click is always required.
 */
export async function queueProfileNudges(): Promise<QueuedProfileNudgeSummary> {
  return {
    students_queued: 0,
    failed: 0,
    skipped_missing_columns: false,
    outside_send_window: false,
    first_error: 'Automatic email sending is disabled; use the admin send button.',
  }
}
