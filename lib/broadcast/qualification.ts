import type { BroadcastQualification, BroadcastWorkerEnv } from './worker'

export const BROADCAST_STAGING_PROJECT = 'aqhktriwaglvvrchxmtd'
export const BROADCAST_STAGING_DATABASE = 'https://aqhktriwaglvvrchxmtd.supabase.co'

export type BroadcastStagingEnv = BroadcastWorkerEnv & {
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  BROADCAST_STAGING_VAPID_PUBLIC_KEY?: string
  BROADCAST_STAGING_VAPID_PRIVATE_KEY?: string
  BROADCAST_STAGING_DROP_FIRST_EMAIL_WAKE?: string
}

function stagingKey(value: string | undefined, role: string) {
  const encoded = value?.split('.')[1]
  if (!encoded) return false
  try {
    const claims = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')))
    return claims.ref === BROADCAST_STAGING_PROJECT && claims.role === role
  } catch {
    return false
  }
}

export function isBroadcastStagingDatabase(env: BroadcastStagingEnv) {
  return env.NEXT_PUBLIC_SUPABASE_URL === BROADCAST_STAGING_DATABASE
    && stagingKey(env.SUPABASE_SERVICE_ROLE_KEY, 'service_role')
    && stagingKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'anon')
}

export function isBroadcastStagingAppRequest(request: Request) {
  const path = new URL(request.url).pathname
  if (path === '/api/admin/broadcast' || path === '/login' || path === '/auth/callback') {
    return request.method === 'GET' || request.method === 'POST'
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  return ['/admin/broadcast', '/api/admin/scholarships', '/api/admin/opportunities', '/favicon.ico'].includes(path)
    || path.startsWith('/_next/static/')
}

const emailPattern = /^broadcast-qualification-\d{3}@broadcast\.example\.invalid$/
const expoPattern = /^ExpoPushToken\[BroadcastQualification\d{3}\]$/
const webPathPattern = /^\/send\/broadcast-qualification-\d{3}$/

export const stubBroadcastProvider: typeof fetch = async (input, init) => {
  // This transport has no network fallback, including for unexpected addresses.
  const path = new URL(input instanceof Request ? input.url : input)
  if (path.protocol !== 'https:' || path.username || path.password || path.port || path.search || path.hash) {
    throw new Error('invalid_staging_provider_route')
  }
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  if (path.hostname === 'api.brevo.com' && path.pathname === '/v3/smtp/email' && emailPattern.test(body?.to?.[0]?.email)) {
    return Response.json({ messageId: 'qualification-brevo-receipt' }, { status: 201 })
  }
  if (path.hostname === 'api.resend.com' && path.pathname === '/emails' && emailPattern.test(body?.to?.[0])) {
    return Response.json({ id: 'qualification-resend-receipt' })
  }
  if (path.hostname === 'exp.host' && path.pathname === '/--/api/v2/push/send' && expoPattern.test(body?.[0]?.to)) {
    return Response.json({ data: [{ status: 'ok', id: 'qualification-expo-ticket' }] })
  }
  if (path.hostname === 'fcm.googleapis.com' && webPathPattern.test(path.pathname)
    && new Headers(init?.headers).get('content-encoding') === 'aes128gcm') {
    return new Response(null, { status: 201 })
  }
  throw new Error('non_synthetic_broadcast_target')
}

export function stagingBroadcastExecution(env: BroadcastStagingEnv): {
  bindings: BroadcastWorkerEnv
  qualification: BroadcastQualification
} {
  return {
    bindings: {
      NEXT_PUBLIC_SUPABASE_URL: BROADCAST_STAGING_DATABASE,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      BROADCAST_CONSUMERS_ENABLED: env.BROADCAST_CONSUMERS_ENABLED,
      BROADCAST_EMAIL_QUEUE: env.BROADCAST_EMAIL_QUEUE,
      BROADCAST_PUSH_QUEUE: env.BROADCAST_PUSH_QUEUE,
      BREVO_API_KEY: 'staging-stub',
      REMINDER_FROM_EMAIL: 'qualification@broadcast.example.invalid',
      RESEND_API_KEY: 'staging-stub',
      RESEND_FROM_EMAIL: 'qualification@broadcast.example.invalid',
      NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: env.BROADCAST_STAGING_VAPID_PUBLIC_KEY,
      WEB_PUSH_VAPID_PRIVATE_KEY: env.BROADCAST_STAGING_VAPID_PRIVATE_KEY,
      WEB_PUSH_SUBJECT: 'mailto:qualification@broadcast.example.invalid',
    },
    qualification: {
      providerFetch: stubBroadcastProvider,
      dropEmailWake: env.BROADCAST_STAGING_DROP_FIRST_EMAIL_WAKE === 'true',
    },
  }
}
