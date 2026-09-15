import type { SupabaseClient } from '@supabase/supabase-js'

const LEASE_MS = 10 * 60 * 1000

type DeliveryInput = {
  profileId: string
  scholarshipId?: string | null
  campaignKey: string
  scheduleBucket: string
  dedupeKey: string
  templateVersion: string
}

type ClaimedDelivery = {
  id: string
  dedupeKey: string
}

export async function claimNotificationDelivery(
  supabase: SupabaseClient,
  input: DeliveryInput,
): Promise<ClaimedDelivery | null> {
  const { error: insertError } = await supabase
    .from('notification_deliveries')
    .upsert(
      {
        profile_id: input.profileId,
        scholarship_id: input.scholarshipId ?? null,
        campaign_key: input.campaignKey,
        channel: 'email',
        schedule_bucket: input.scheduleBucket,
        dedupe_key: input.dedupeKey,
        template_version: input.templateVersion,
        status: 'pending',
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  if (insertError) throw insertError

  const now = new Date()
  const nowIso = now.toISOString()
  const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString()
  const { data: existing, error: readError } = await supabase
    .from('notification_deliveries')
    .select('id,attempts,status,lease_until')
    .eq('dedupe_key', input.dedupeKey)
    .maybeSingle()
  if (readError) throw readError
  if (!existing) return null

  const retryable = existing.status === 'retryable'
  const pending = existing.status === 'pending'
  const expiredLease =
    existing.status === 'leased' &&
    existing.lease_until != null &&
    existing.lease_until < nowIso
  if (!pending && !retryable && !expiredLease) return null

  const { data: claimed, error: claimError } = await supabase
    .from('notification_deliveries')
    .update({
      status: 'leased',
      attempts: (existing.attempts ?? 0) + 1,
      available_at: nowIso,
      lease_until: leaseUntil,
    })
    .eq('id', existing.id)
    .or(`status.eq.pending,status.eq.retryable,and(status.eq.leased,lease_until.lt.${nowIso})`)
    .lte('available_at', nowIso)
    .select('id')
    .maybeSingle()
  if (claimError) throw claimError
  return claimed ? { id: claimed.id, dedupeKey: input.dedupeKey } : null
}

export async function markNotificationAccepted(
  supabase: SupabaseClient,
  deliveryId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notification_deliveries')
    .update({ status: 'accepted', sent_at: new Date().toISOString(), lease_until: null })
    .eq('id', deliveryId)
    .eq('status', 'leased')
  if (error) throw error
}

export async function markNotificationRetryable(
  supabase: SupabaseClient,
  deliveryId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const { error: updateError } = await supabase
    .from('notification_deliveries')
    .update({
      status: 'retryable',
      lease_until: null,
      available_at: new Date(Date.now() + LEASE_MS).toISOString(),
      last_error: { message: message.slice(0, 500) },
    })
    .eq('id', deliveryId)
    .eq('status', 'leased')
  if (updateError) throw updateError
}
