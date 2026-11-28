export const broadcastStatusKeys = [
  'queued', 'processing', 'accepted', 'failed', 'uncertain', 'quota_deferred', 'unattempted', 'bookkeeping_errors',
] as const

export type BroadcastState = typeof broadcastStatusKeys[number]
export type BroadcastCounts = Record<BroadcastState, number> & { total: number }
export type BroadcastStatus = {
  id: string
  batch: 'A' | 'B' | 'C' | null
  created_at: string
  completed_at: string | null
  email: BroadcastCounts
  push_profiles: BroadcastCounts
  push_devices: BroadcastCounts
  email_next_at: string | null
  push_next_at: string | null
  email_hold: string | null
  push_hold: string | null
}

export type BroadcastOverview = {
  recipientCount: number
  pushRecipientCount: number
  recent: { id: string; batch: BroadcastStatus['batch']; created_at: string; completed_at: string | null }[]
}
