// lib/ratelimit.ts
//
// Shared Upstash Redis-backed rate limiting.
//
// Production behavior is fail closed: if Redis is not configured or becomes
// unreachable, protected routes return 503 instead of silently becoming
// unthrottled. Local development remains usable without Redis.
import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logWarn } from '@/lib/logging'

let redis: Redis | null = null
const limiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  if (!redis) redis = Redis.fromEnv()
  return redis
}

function getLimiter(route: string, limit: number, client: Redis): Ratelimit {
  const key = `${route}:${limit}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, '60 s'),
      analytics: false,
      prefix: `scholars:rl:${route}`,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Rate limiting service unavailable. Please try again shortly.' },
    { status: 503 }
  )
}

export async function checkRateLimit(
  request: Request,
  opts: { route: string; limit: number; extraKeys?: string[] }
): Promise<NextResponse | null> {
  const client = getRedis()
  if (!client) {
    if (process.env.NODE_ENV === 'production') {
      logWarn('ratelimit', 'redis_not_configured_fail_closed', { route: opts.route })
      return unavailableResponse()
    }
    return null
  }

  const limiter = getLimiter(opts.route, opts.limit, client)
  const keys = [`ip:${clientIp(request)}`, ...(opts.extraKeys ?? [])]

  try {
    for (const key of keys) {
      const { success } = await limiter.limit(key)
      if (!success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      }
    }
    return null
  } catch {
    logWarn('ratelimit', 'upstash_unreachable_fail_closed', { route: opts.route })
    return unavailableResponse()
  }
}
