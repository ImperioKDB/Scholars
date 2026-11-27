import type { SupabaseClient } from '@supabase/supabase-js'

const receiptBatchSize = 8
const campaign = 'deadline_reminder_v2'

type ReceiptStatus = 'delivered' | 'bounced' | 'failed' | 'suppressed'

export async function readMailtrapReceipt(accountId: string, token: string, messageId: string): Promise<ReceiptStatus | null> {
  // Message IDs are a path segment in the logs API.
  if (!/^[\w-]+$/.test(messageId)) return null
  const response = await fetch(`https://mailtrap.io/api/accounts/${accountId}/email_logs/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Mailtrap logs returned HTTP ${response.status}`)

  const receipt = await response.json() as {
    message_id?: string
    status?: string
    events?: { event_type?: string }[]
  }
  if (receipt.message_id !== messageId) return null
  if (receipt.status === 'delivered') return 'delivered'
  if (receipt.status === 'opted_out') return 'suppressed'
  if (receipt.status === 'not_delivered') {
    return Array.isArray(receipt.events) && receipt.events.some((event) => event.event_type === 'bounce')
      ? 'bounced' : 'failed'
  }
  return null
}

export async function reconcileDeadlineEmails(service: SupabaseClient) {
  const summary = { checked: 0, confirmed: 0, failed: 0, pending: 0, unavailable: 0 }
  const accountId = process.env.MAILTRAP_ACCOUNT_ID?.trim() ?? ''
  const token = process.env.MAILTRAP_LOG_API_TOKEN?.trim()
  if (!token || !/^\d+$/.test(accountId)) return summary

  const now = Date.now()
  const iso = (time: number) => new Date(time).toISOString()
  const { data, error } = await service
    .from('notification_deliveries')
    .select('provider_message_id')
    .eq('campaign_key', campaign)
    .eq('channel', 'email')
    .eq('status', 'accepted')
    .not('provider_message_id', 'is', null)
    .lte('available_at', iso(now))
    .lte('sent_at', iso(now - 15 * 60_000))
    .gte('sent_at', iso(now - 7 * 86_400_000))
    .order('available_at')
    .order('id')
    .limit(receiptBatchSize * 12)
  if (error) throw error

  const ids = [...new Set((data ?? []).map((row) => row.provider_message_id as string))]
    .slice(0, receiptBatchSize)
  await Promise.all(ids.map(async (messageId) => {
    let status: ReceiptStatus | null = null
    let checked = false
    try {
      status = await readMailtrapReceipt(accountId, token, messageId)
      checked = true
      summary.checked += 1
    } catch {
      summary.unavailable += 1
    }

    // Rotate pending/unavailable IDs to the back so a missing log or read
    // outage cannot monopolize later batches. Never change an unknown send.
    const { error: updateError } = await service
      .from('notification_deliveries')
      .update(status
        ? { status, ...(status === 'delivered' ? {} : { last_error: { code: `mailtrap_log_${status}` } }) }
        : { available_at: iso(now + 4 * 3_600_000) })
      .eq('campaign_key', campaign)
      .eq('channel', 'email')
      .eq('status', 'accepted')
      .eq('provider_message_id', messageId)
    if (updateError) throw updateError
    if (status === 'delivered') summary.confirmed += 1
    else if (status) summary.failed += 1
    else if (checked) summary.pending += 1
  }))
  return summary
}
