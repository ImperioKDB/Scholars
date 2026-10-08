import type { SupabaseClient } from '@supabase/supabase-js'
import {
  claimNotificationDeliveryById,
  ensureNotificationDelivery,
  markNotificationAccepted,
} from '@/lib/email/outbox'
import { sendPushForProfile, type PushDeliverySummary } from './deliver'

const DEVICE_PAGE_SIZE = 500
const MAX_DEVICE_ROWS_PER_CHANNEL = 10_000
const MAX_PUSH_PROFILES = 2_000
const SEND_CONCURRENCY = 5

type PushTable = 'push_tokens' | 'web_push_subscriptions'

export type AdminBroadcastPushMessage = {
  title: string
  body: string
  url: string
}

export type AdminBroadcastPushSummary = {
  recipients: number
  attempted: number
  acceptedProfiles: number
  acceptedDevices: number
  failedProfiles: number
  failedDevices: number
  suppressedProfiles: number
  deduplicatedProfiles: number
}

/** Return distinct accounts with at least one currently enabled push device. */
export async function listEnabledPushProfileIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const profileIds = new Set<string>()
  const tables: PushTable[] = ['push_tokens', 'web_push_subscriptions']

  for (const table of tables) {
    for (let offset = 0; offset < MAX_DEVICE_ROWS_PER_CHANNEL; offset += DEVICE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select('id,profile_id')
        .eq('enabled', true)
        .order('id', { ascending: true })
        .range(offset, offset + DEVICE_PAGE_SIZE - 1)
      if (error) throw error

      for (const row of data ?? []) {
        profileIds.add(row.profile_id as string)
        if (profileIds.size > MAX_PUSH_PROFILES) {
          throw new Error(`Admin push broadcasts are limited to ${MAX_PUSH_PROFILES} opted-in profiles per send.`)
        }
      }
      if (!data || data.length < DEVICE_PAGE_SIZE) break
      if (offset + DEVICE_PAGE_SIZE >= MAX_DEVICE_ROWS_PER_CHANNEL) {
        throw new Error(`The ${table} audience exceeds the safe device-scan limit.`)
      }
    }
  }

  return [...profileIds].sort()
}

function dedupeKeyFor(broadcastId: string, profileId: string): string {
  return `admin-broadcast-push:${broadcastId}:${profileId}`
}

async function finishWithoutAcceptance(
  supabase: SupabaseClient,
  deliveryId: string,
  status: 'failed' | 'suppressed',
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from('notification_deliveries')
    .update({
      status,
      lease_until: null,
      last_error: { message },
    })
    .eq('id', deliveryId)
    .eq('status', 'leased')
  if (error) throw error
}

async function deliverToProfile(
  supabase: SupabaseClient,
  broadcastId: string,
  profileId: string,
  message: AdminBroadcastPushMessage,
): Promise<{ state: 'accepted' | 'failed' | 'suppressed' | 'deduplicated'; delivery?: PushDeliverySummary }> {
  const dedupeKey = dedupeKeyFor(broadcastId, profileId)
  const intent = await ensureNotificationDelivery(supabase, {
    profileId,
    campaignKey: 'admin_broadcast',
    channel: 'push',
    scheduleBucket: broadcastId,
    dedupeKey,
    templateVersion: 'admin-broadcast-push-v1',
  })
  if (!intent) return { state: 'failed' }

  const claimed = await claimNotificationDeliveryById(supabase, intent.id, dedupeKey)
  if (!claimed) return { state: 'deduplicated' }

  try {
    const delivery = await sendPushForProfile(supabase, profileId, {
      title: message.title,
      body: message.body,
      data: { url: message.url },
    })

    if (delivery.accepted > 0) {
      await markNotificationAccepted(supabase, intent.id)
      return { state: 'accepted', delivery }
    }

    if (delivery.failed > 0) {
      await finishWithoutAcceptance(supabase, intent.id, 'failed', 'Push provider did not accept the broadcast notification.')
      return { state: 'failed', delivery }
    }

    await finishWithoutAcceptance(supabase, intent.id, 'suppressed', 'No active push device was available at send time.')
    return { state: 'suppressed', delivery }
  } catch (error) {
    try {
      await finishWithoutAcceptance(supabase, intent.id, 'failed', 'Push broadcast delivery failed.')
    } catch (recordError) {
      console.error('[AdminPushBroadcast] Could not record a failed delivery', {
        broadcastId,
        profileId,
        errorName: recordError instanceof Error ? recordError.name : 'UnknownError',
      })
    }
    console.warn('[AdminPushBroadcast] Push delivery failed', {
      broadcastId,
      profileId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return { state: 'failed' }
  }
}

/** Send one broadcast notification per opted-in profile, with outbox deduplication. */
export async function sendAdminBroadcastPush(
  supabase: SupabaseClient,
  profileIds: string[],
  broadcastId: string,
  message: AdminBroadcastPushMessage,
): Promise<AdminBroadcastPushSummary> {
  const summary: AdminBroadcastPushSummary = {
    recipients: profileIds.length,
    attempted: 0,
    acceptedProfiles: 0,
    acceptedDevices: 0,
    failedProfiles: 0,
    failedDevices: 0,
    suppressedProfiles: 0,
    deduplicatedProfiles: 0,
  }

  let nextIndex = 0
  async function worker() {
    for (;;) {
      const index = nextIndex++
      if (index >= profileIds.length) return
      let result: Awaited<ReturnType<typeof deliverToProfile>>
      try {
        result = await deliverToProfile(supabase, broadcastId, profileIds[index], message)
      } catch (error) {
        summary.attempted += 1
        summary.failedProfiles += 1
        console.warn('[AdminPushBroadcast] Could not process recipient', {
          broadcastId,
          profileId: profileIds[index],
          errorName: error instanceof Error ? error.name : 'UnknownError',
        })
        continue
      }
      if (result.state === 'deduplicated') {
        summary.deduplicatedProfiles += 1
        continue
      }
      summary.attempted += 1
      if (result.state === 'failed') {
        summary.failedProfiles += 1
        summary.failedDevices += result.delivery?.failed ?? 0
        continue
      }
      if (result.state === 'suppressed') {
        summary.suppressedProfiles += 1
        continue
      }
      summary.acceptedProfiles += 1
      summary.acceptedDevices += result.delivery?.accepted ?? 0
      summary.failedDevices += result.delivery?.failed ?? 0
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(SEND_CONCURRENCY, profileIds.length) }, () => worker()),
  )
  return summary
}
