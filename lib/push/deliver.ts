import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { sendExpoPushMessages } from './send'

type PushMessage = { title: string; body: string; data?: Record<string, string> }
type WebPushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }
type ChannelResult = { targets: number; accepted: number; failed: number }
export type PushDeliverySummary = { targets: number; accepted: number; failed: number }

function getStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null
  const statusCode = (error as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : null
}

async function sendExpoPushForProfile(
  supabase: SupabaseClient,
  profileId: string,
  message: PushMessage,
): Promise<ChannelResult> {
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id,expo_push_token')
    .eq('profile_id', profileId)
    .eq('enabled', true)
    .limit(100)
  if (error) throw error
  if (!tokens?.length) return { targets: 0, accepted: 0, failed: 0 }

  const result = await sendExpoPushMessages(tokens.map((token) => ({
    to: token.expo_push_token as string,
    title: message.title,
    body: message.body,
    data: message.data,
    channelId: 'scholarships',
  })))

  if (result.invalidTokens.length > 0) {
    const { error: disableError } = await supabase
      .from('push_tokens')
      .update({ enabled: false })
      .eq('profile_id', profileId)
      .in('expo_push_token', result.invalidTokens)
    if (disableError) throw disableError
  }

  const accepted = result.tickets.filter((ticket) => ticket.status === 'ok').length
  return { targets: tokens.length, accepted, failed: Math.max(0, tokens.length - accepted) }
}

async function sendWebPushForProfile(
  supabase: SupabaseClient,
  profileId: string,
  message: PushMessage,
): Promise<ChannelResult> {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return { targets: 0, accepted: 0, failed: 0 }

  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT || 'mailto:support.scholarsteam@gmail.com',
    publicKey,
    privateKey,
  )

  const { data, error } = await supabase
    .from('web_push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('profile_id', profileId)
    .eq('enabled', true)
    .limit(100)
  if (error) throw error

  const subscriptions = (data ?? []) as WebPushSubscriptionRow[]
  if (subscriptions.length === 0) return { targets: 0, accepted: 0, failed: 0 }
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    data: { url: message.data?.url || '/notifications' },
  })
  let accepted = 0
  let failed = 0
  await Promise.all(subscriptions.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        { TTL: 60 * 60 },
      )
      accepted += 1
    } catch (error) {
      failed += 1
      const statusCode = getStatusCode(error)
      if (statusCode === 404 || statusCode === 410) {
        const { error: removeError } = await supabase.from('web_push_subscriptions').delete().eq('id', row.id)
        if (removeError) throw removeError
        return
      }
      // Push endpoints are private bearer URLs; never log the URL or keys.
      console.warn('[Push] Web Push delivery failed', { profileId, statusCode })
    }
  }))
  return { targets: subscriptions.length, accepted, failed }
}

/** Deliver to both opt-in browser subscriptions and Expo native devices. */
export async function sendPushForProfile(
  supabase: SupabaseClient,
  profileId: string,
  message: PushMessage,
): Promise<PushDeliverySummary> {
  const channels = await Promise.allSettled([
    sendExpoPushForProfile(supabase, profileId, message),
    sendWebPushForProfile(supabase, profileId, message),
  ])
  let targets = 0
  let accepted = 0
  let failed = 0
  channels.forEach((result, index) => {
    if (result.status === 'rejected') {
      failed += 1
      console.warn('[Push] Delivery channel failed', {
        channel: index === 0 ? 'expo' : 'web',
        profileId,
        errorName: result.reason instanceof Error ? result.reason.name : 'UnknownError',
      })
      return
    }
    targets += result.value.targets
    accepted += result.value.accepted
    failed += result.value.failed
  })
  return { targets, accepted, failed }
}
