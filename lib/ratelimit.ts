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
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!rawUrl || !rawToken) return null

  try {
    // Cloudflare dashboard copy/paste can introduce trailing newlines.
    // Normalize both values before constructing the Upstash client.
    const url = rawUrl.trim()
    const token = rawToken.trim()

    if (!url || !token) return null

    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) return null

    if (!redis) redis = new Redis({ url, token })
    return redis
  } catch {
    // Initialization errors are handled by checkRateLimit as fail-closed.
    return null
  }
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
  // Cloudflare supplies CF-Connecting-IP to the Worker for the
  // visitor address. Prefer it when the application is behind
  // Cloudflare, then retain the Vercel and real-IP fallbacks.
  // Never use client-provided x-forwarded-for as the bucket key.
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) return cloudflareIp;

  const vercelIp = request.headers
    .get('x-vercel-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  if (vercelIp) return vercelIp;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
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

  try {
    // Include limiter construction inside the protected block. Redis
    // initialization and limiter construction must not escape uncaught.
    const limiter = getLimiter(opts.route, opts.limit, client)
    const keys = [`ip:${clientIp(request)}`, ...(opts.extraKeys ?? [])]

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
