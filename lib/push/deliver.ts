import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { sendExpoPushMessages } from './send'
import {
  getSafePushErrorDiagnostic,
  getSafeHttpStatusCode,
} from './errorDiagnostics'

type PushMessage = { title: string; body: string; data?: Record<string, string> }
type WebPushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }
export type PushDeliverySummary = {
  targets: number
  accepted: number
  failed: number
  retryable: number
  expired: number
  uncertain?: number
}

function emptyResult(): PushDeliverySummary {
  return { targets: 0, accepted: 0, failed: 0, retryable: 0, expired: 0 }
}

function isRetryable(status: number | undefined | null) {
  return !status || [408, 425, 429].includes(status) || status >= 500
}

async function sendExpoPushForProfile(
  supabase: SupabaseClient,
  profileId: string,
  message: PushMessage,
  deviceLimit: number,
  ttl?: number,
): Promise<PushDeliverySummary> {
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('id,expo_push_token')
    .eq('profile_id', profileId)
    .eq('enabled', true)
    .order('id').limit(deviceLimit).retry(false)
  if (error) throw error
  if (!tokens?.length) return emptyResult()

  const result = await sendExpoPushMessages(tokens.map((token) => ({
    to: token.expo_push_token as string,
    title: message.title,
    body: message.body,
    data: message.data,
    channelId: 'scholarships',
    ttl,
  }))).catch((error: unknown) => {
    if (getSafeHttpStatusCode(error)) throw error
    return null
  })
  if (!result) return { ...emptyResult(), targets: tokens.length, failed: tokens.length, retryable: tokens.length, uncertain: tokens.length }

  if (result.invalidTokens.length > 0) {
    try {
      const { error: disableError } = await supabase
        .from('push_tokens')
        .update({ enabled: false })
        .eq('profile_id', profileId)
        .in('expo_push_token', result.invalidTokens).retry(false)
      if (disableError) throw disableError
    } catch {
      console.warn('[Push] Failed to disable expired Expo devices')
    }
  }

  const accepted = result.tickets.filter((ticket) => ticket.status === 'ok').length
  const permanent = new Set(['DeviceNotRegistered', 'MessageTooBig', 'InvalidCredentials', 'MismatchSenderId'])
  const retryable = tokens.filter((_, index) => {
    const ticket = result.tickets[index]
    return ticket?.status !== 'ok' && !permanent.has(ticket?.details?.error ?? '')
  }).length
  return {
    targets: tokens.length, accepted, failed: tokens.length - accepted, retryable,
    expired: result.invalidTokens.length,
    uncertain: Math.max(0, tokens.length - result.tickets.length),
  }
}

async function sendWebPushForProfile(
  supabase: SupabaseClient,
  profileId: string,
  message: PushMessage,
  deviceLimit: number,
  ttl?: number,
): Promise<PushDeliverySummary> {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return emptyResult()

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
    .order('id').limit(deviceLimit).retry(false)
  if (error) throw error

  const subscriptions = (data ?? []) as WebPushSubscriptionRow[]
  if (subscriptions.length === 0) return emptyResult()
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    data: { url: message.data?.url || '/notifications' },
  })
  let accepted = 0
  let failed = 0
  let retryable = 0
  let uncertain = 0
  const expired: string[] = []
  await Promise.all(subscriptions.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        { TTL: ttl ?? 3600, timeout: 10_000 },
      )
      accepted += 1
    } catch (error) {
      failed += 1
      const statusCode = getSafeHttpStatusCode(error)
      if (statusCode === 404 || statusCode === 410) {
        expired.push(row.id)
        return
      }
      if (!statusCode) uncertain += 1
      else if (isRetryable(statusCode)) retryable += 1
      // Push endpoints are private bearer URLs; never log the URL or keys.
      console.warn('[Push] Web Push delivery failed', {
        statusCode,
        ...getSafePushErrorDiagnostic(error),
      })
    }
  }))
  if (expired.length > 0) {
    try {
      const { error } = await supabase.from('web_push_subscriptions').delete().in('id', expired).retry(false)
      if (error) throw error
    } catch {
      console.warn('[Push] Failed to remove expired web subscriptions')
    }
  }
  return { targets: subscriptions.length, accepted, failed, retryable: retryable + uncertain, expired: expired.length, uncertain }
}

/** Deliver to both opt-in browser subscriptions and Expo native devices. */
export async function sendPushForProfile(
  supabase: SupabaseClient,
  profileId: string,
  message: PushMessage,
  { deviceLimit = 100, ttl }: { deviceLimit?: number; ttl?: number } = {},
): Promise<PushDeliverySummary> {
  const channels = await Promise.allSettled([
    sendExpoPushForProfile(supabase, profileId, message, deviceLimit, ttl),
    sendWebPushForProfile(supabase, profileId, message, deviceLimit, ttl),
  ])
  const summary = emptyResult()
  channels.forEach((result, index) => {
    if (result.status === 'rejected') {
      summary.failed += 1
      if (isRetryable(getSafeHttpStatusCode(result.reason))) summary.retryable += 1
      console.warn('[Push] Delivery channel failed', {
        channel: index === 0 ? 'expo' : 'web',
        ...getSafePushErrorDiagnostic(result.reason),
      })
      return
    }
    summary.targets += result.value.targets
    summary.accepted += result.value.accepted
    summary.failed += result.value.failed
    summary.retryable += result.value.retryable
    summary.expired += result.value.expired
    if (result.value.uncertain) summary.uncertain = (summary.uncertain ?? 0) + result.value.uncertain
  })
  return summary
}
