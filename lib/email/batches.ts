export const EMAIL_BATCH_SIZE = 300

export const EMAIL_BATCHES = ['A', 'B', 'C'] as const
export type EmailBatch = (typeof EMAIL_BATCHES)[number]

export function isEmailBatch(value: unknown): value is EmailBatch {
  return typeof value === 'string' && EMAIL_BATCHES.includes(value as EmailBatch)
}

export function batchLabel(batch: EmailBatch): string {
  return `Batch ${batch}`
}

/**
 * Keep campaign audiences deterministic: all callers build their recipient
 * list in a stable order, then select one 300-recipient window.
 */
export function selectEmailBatch<T>(items: T[], batch?: EmailBatch): T[] {
  if (!batch) return items
  const index = EMAIL_BATCHES.indexOf(batch)
  return items.slice(index * EMAIL_BATCH_SIZE, (index + 1) * EMAIL_BATCH_SIZE)
}
