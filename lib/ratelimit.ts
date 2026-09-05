// lib/ratelimit.ts
//
// Shared Upstash Redis-backed rate limiting (security hardening, phase 1).
//
// WHY: the only limiter in this codebase was an in-memory Map in
// app/api/auth/password-check -- useless on Vercel's ephemeral serverless
// functions, where every cold start resets the Map and concurrent
// instances never share it. Upstash Redis keeps the sliding window outside
// the function, so limits hold across cold starts and across instances.
//
// BEHAVIOR:
//   - Env vars unset (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN):
//     skip silently, the same dry-run-safe pattern the cron uses for
//     BREVO_API_KEY. Local dev and pre-provisioning deploys keep working.
//   - Upstash unreachable: fail open with a warn log. An outage in the
//     rate-limit backend must not take the API down; auth (RLS plus the
//     server-side checks in each route) remains the real access gate.
//   - Limit exceeded: 429 with { error: "Too many requests" }, the exact
//     body shape every route in this codebase already returns.
//
// USAGE (top of a route handler, before any other work):
//   const limited = await checkRateLimit(request, { route: 'save', limit: 20 })
//   if (limited) return limited
//
// extraKeys adds per-identity buckets on top of the IP bucket (see
// app/api/xp/share/route.ts for IP + user).
import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

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

export async function checkRateLimit(
  request: Request,
  opts: { route: string; limit: number; extraKeys?: string[] }
): Promise<NextResponse | null> {
  const client = getRedis()
  if (!client) return null // env not set: skip silently (dry-run-safe)
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
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'ratelimit_fail_open',
        route: opts.route,
        timestamp: new Date().toISOString(),
      })
    )
    return null
  }
}
