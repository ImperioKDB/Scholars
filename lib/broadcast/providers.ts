import webpush from 'web-push'
import { BREVO_EMAIL_ENDPOINT, brevoRequest } from '@/lib/email/providers/brevo'
import { RESEND_EMAIL_ENDPOINT, resendRequest } from '@/lib/email/providers/resend'
import { safeProviderCode } from '@/lib/email/providers/types'
import { renderBroadcastDigest, type EmailListing } from '@/lib/email/template'
import { buildListingBroadcastPushMessage } from '@/lib/push/broadcastContent'
import { isAllowedPushEndpoint } from '@/lib/push/endpoint'
import { EXPO_PUSH_ENDPOINT, expoPushRequest } from '@/lib/push/expoRequest'
import { readBoundedJson } from './transport'

export type BroadcastProviderEnv = {
  BREVO_API_KEY?: string
  REMINDER_FROM_EMAIL?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?: string
  WEB_PUSH_VAPID_PRIVATE_KEY?: string
  WEB_PUSH_SUBJECT?: string
}

type Provider = 'brevo' | 'resend' | 'expo' | 'web'
type Device = { token: string } | { endpoint: string; auth: string; p256dh: string }
export type ClaimTarget = {
  id: string
  transport: 'email' | 'web' | 'expo'
  address: string | null
  first_name: string | null
  next_provider: 'resend' | null
  device: Device | null
}
export type CampaignContent = { version: 1; baseUrl: string; items: EmailListing[] }
type Skip = 'device_unavailable' | 'device_invalid' | 'provider_not_configured'
type Dispatch = { provider: Provider; key: string; url: string; init: RequestInit; canFallback?: boolean }
export type Outcome = {
  state: 'accepted' | 'failed' | 'uncertain' | 'deferred' | 'fallback'
  messageId?: string | null
  reason?: string
  retrySeconds?: number
}

export function prepareBroadcast(
  env: BroadcastProviderEnv, campaign: string, content: CampaignContent, target: ClaimTarget,
): Dispatch | Skip {
  if (content.version !== 1) throw new Error('broadcast_content_version')
  if (target.transport === 'email') {
    const address = target.address
    if (!address) throw new Error('broadcast_address_missing')
    const brevo = env.BREVO_API_KEY && env.REMINDER_FROM_EMAIL
    const resend = env.RESEND_API_KEY && env.RESEND_FROM_EMAIL
    const useBrevo = target.next_provider === null && Boolean(brevo)
    if (!useBrevo && !resend) return 'provider_not_configured'
    const idempotencyKey = 'broadcast/' + campaign + '/' + target.id
    const input = {
      ...renderBroadcastDigest({
        firstName: target.first_name || address.split('@')[0],
        items: content.items,
        baseUrl: content.baseUrl,
      }),
      to: address,
      idempotencyKey,
    }
    return useBrevo
      ? {
        provider: 'brevo', key: 'brevo', url: BREVO_EMAIL_ENDPOINT, canFallback: Boolean(resend),
        init: brevoRequest(input, env.BREVO_API_KEY!, env.REMINDER_FROM_EMAIL!, idempotencyKey),
      }
      : {
        provider: 'resend', key: 'resend', url: RESEND_EMAIL_ENDPOINT,
        init: resendRequest(input, env.RESEND_API_KEY!, env.RESEND_FROM_EMAIL!),
      }
  }

  const device = target.device
  if (!device) return 'device_unavailable'
  const message = buildListingBroadcastPushMessage(content.items)
  if (target.transport === 'expo') {
    if (!('token' in device) || !/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_+\-/=]+\]$/.test(device.token)) {
      return 'device_invalid'
    }
    return {
      provider: 'expo', key: 'expo', url: EXPO_PUSH_ENDPOINT,
      init: expoPushRequest([{
        to: device.token, title: message.title, body: message.body,
        data: { url: message.url }, channelId: 'scholarships',
      }]),
    }
  }

  if (!('endpoint' in device) || !isAllowedPushEndpoint(device.endpoint)) return 'device_invalid'
  const publicKey = env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return 'provider_not_configured'
  try {
    // Use the existing encryption and VAPID implementation, with explicit
    // fetch transport so Web Push shares deadlines and the subrequest budget.
    const prepared = webpush.generateRequestDetails(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify({ title: message.title, body: message.body, data: { url: message.url } }),
      { TTL: 3600, vapidDetails: { subject: env.WEB_PUSH_SUBJECT || 'mailto:support.scholarsteam@gmail.com', publicKey, privateKey } },
    )
    return {
      provider: 'web', key: 'web:' + new URL(device.endpoint).hostname, url: prepared.endpoint,
      init: {
        method: prepared.method,
        headers: Object.fromEntries(Object.entries(prepared.headers).map(([key, value]) => [key, String(value)])),
        body: prepared.body ? new Uint8Array(prepared.body) : undefined,
      },
    }
  } catch {
    // A malformed subscription cannot produce an outbound request.
    return 'device_invalid'
  }
}

function retrySeconds(headers: Headers, fallback = 60) {
  const raw = headers.get('retry-after')?.trim()
  const headerSeconds = !raw ? NaN : /^\d+$/.test(raw)
    ? Number(raw)
    : Math.ceil((Date.parse(raw) - Date.now()) / 1000)
  const reset = ["ratelimit-reset", "x-sib-ratelimit-reset"].map((name) => {
    const value = headers.get(name)
    return value && /^\d+$/.test(value) ? Number(value) : 0
  })
  return Math.min(2_147_483_647, Math.max(
    Number.isNaN(headerSeconds) ? fallback : headerSeconds, ...reset, 1,
  ))
}

function providerId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_+.@<>%=-]{1,256}$/.test(value) ? value : null
}

export async function dispatchBroadcast(dispatch: Dispatch, fetcher: typeof fetch): Promise<Outcome> {
  let response: Response
  try {
    response = await fetcher(dispatch.url, dispatch.init)
  } catch {
    return { state: 'uncertain', reason: 'network_error' }
  }

  const { provider } = dispatch
  const status = response.status
  type Body = { id?: string; messageId?: string; code?: string; name?: string; data?: unknown }
  const payload = provider === 'web'
    ? null
    : await readBoundedJson<Body>(response, 8192).catch(() => null)
  if (provider === 'web') void response.body?.cancel().catch(() => {})
  if (response.ok) {
    if (provider !== 'expo') {
      const id = provider === 'brevo' ? payload?.messageId : payload?.id
      return { state: 'accepted', messageId: providerId(id) }
    }
    const tickets = payload?.data
    const ticket = Array.isArray(tickets) && tickets.length === 1 ? tickets[0] : null
    if (ticket?.status === 'ok') {
      return { state: 'accepted', messageId: providerId(ticket.id) }
    }
    if (ticket?.status === 'error') {
      if (ticket.details?.error === 'MessageRateExceeded') {
        return { state: 'deferred', reason: 'provider_rate_limit', retrySeconds: retrySeconds(response.headers) }
      }
      return { state: 'failed', reason: ticket.details?.error === 'DeviceNotRegistered' ? 'device_gone' : 'expo_ticket_rejected' }
    }
    return { state: 'uncertain', reason: 'expo_ticket_missing' }
  }

  const code = safeProviderCode(payload?.code ?? payload?.name)
  if (
    (provider === 'brevo' && (status === 402 || (status === 429 && code === 'not_enough_credits')))
    || (provider === 'resend' && status === 429 && (code === 'daily_quota_exceeded' || code === 'monthly_quota_exceeded'))
  ) {
    return {
      state: 'deferred', reason: code === 'monthly_quota_exceeded' ? 'monthly_quota' : 'daily_quota',
      retrySeconds: retrySeconds(response.headers, 900),
    }
  }
  if (status === 429 && (provider !== 'resend' || code === 'rate_limit_exceeded')) {
    return { state: 'deferred', reason: 'provider_rate_limit', retrySeconds: retrySeconds(response.headers) }
  }
  if (provider === 'brevo' && dispatch.canFallback && (status === 401 || status === 403)) {
    return { state: 'fallback', reason: 'brevo_http_' + status }
  }
  if (provider === 'web' && (status === 404 || status === 410)) return { state: 'failed', reason: 'device_gone' }
  if ([400, 401, 403, 404, 405, 406, 410, 413, 422].includes(status)) {
    return { state: 'failed', reason: provider + '_http_' + status }
  }
  return {
    state: 'uncertain', reason: provider + '_ambiguous_http',
    retrySeconds: response.headers.has('retry-after') ? retrySeconds(response.headers) : undefined,
  }
}
