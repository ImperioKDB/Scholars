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

export async function ensureNotificationDelivery(
  supabase: SupabaseClient,
  input: DeliveryInput,
): Promise<{ id: string; status: string } | null> {
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

  const { data, error } = await supabase
    .from('notification_deliveries')
    .select('id,status')
    .eq('dedupe_key', input.dedupeKey)
    .maybeSingle()
  if (error) throw error
  return data ? { id: data.id as string, status: data.status as string } : null
}

export async function claimNotificationDelivery(
  supabase: SupabaseClient,
  input: DeliveryInput,
): Promise<ClaimedDelivery | null> {
  const delivery = await ensureNotificationDelivery(supabase, input)
  if (!delivery) return null
  return claimNotificationDeliveryById(supabase, delivery.id, input.dedupeKey)
}

export async function claimNotificationDeliveryById(
  supabase: SupabaseClient,
  deliveryId: string,
  dedupeKey = deliveryId,
): Promise<ClaimedDelivery | null> {
  const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString()
  const { data, error } = await supabase.rpc('claim_notification_delivery', {
    p_delivery_id: deliveryId,
    p_lease_until: leaseUntil,
  })
  if (error) throw error
  const claimed = Array.isArray(data) ? data[0] : data
  return claimed?.id ? { id: claimed.id as string, dedupeKey: (claimed.dedupe_key as string | undefined) ?? dedupeKey } : null
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
