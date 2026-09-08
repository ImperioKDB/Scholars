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
// BEHAVIOR (audit fix, batch 2):
//   - Env vars unset (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN):
//     skip silently, the same dry-run-safe pattern the cron uses for
//     BREVO_API_KEY. Local dev and pre-provisioning deploys keep working.
//   - Upstash unreachable: FAIL CLOSED against a per-instance in-memory
//     sliding window (conservative 10/min) instead of failing open. An
//     outage in the rate-limit backend must not open the floodgates to
//     scripted abuse; auth (RLS + server-side checks) stays the real
//     access gate, but rate limiting is the first line of defense.
//   - Limit exceeded: 429 with { error: "Too many requests" }, the exact
//     body shape every route in this codebase already returns.
//
// PERF (batch 1): the in-memory fallback Map used to grow without bound
// during a long Upstash outage. It is now swept down to live entries
// whenever it overshoots IN_MEMORY_MAX_BUCKETS.
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
import { logWarn } from '@/lib/logging'

let redis: Redis | null = null
const limiters = new Map<string, Ratelimit>()

// In-memory fallback for when Upstash is unreachable. Per-instance only
// (resets on cold start), but still a brake against scripted attacks
// hitting a single instance. Keyed by route:bucketKey, stores timestamps
// of recent requests within the sliding window.
const inMemoryBuckets = new Map<string, number[]>()
const IN_MEMORY_WINDOW_MS = 60_000
const IN_MEMORY_MAX_PER_MINUTE = 10 // conservative fallback
const IN_MEMORY_MAX_BUCKETS = 5000 // bounded-growth cap (batch 1)

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

// In-memory sliding window check. Returns true when the limit is exceeded.
function checkInMemory(bucketKey: string, limit: number): boolean {
  const now = Date.now()
  const windowStart = now - IN_MEMORY_WINDOW_MS
  let timestamps = inMemoryBuckets.get(bucketKey) ?? []
  timestamps = timestamps.filter((t) => t > windowStart)
  const exceeded = timestamps.length >= limit
  if (!exceeded) timestamps.push(now)

  if (timestamps.length === 0) {
    inMemoryBuckets.delete(bucketKey)
  } else {
    inMemoryBuckets.set(bucketKey, timestamps)
  }

  // Bounded growth (batch 1): when the bucket count overshoots the cap,
  // sweep every bucket down to its live entries so a long Upstash outage
  // cannot leak memory indefinitely.
  if (inMemoryBuckets.size > IN_MEMORY_MAX_BUCKETS) {
    for (const [key, values] of inMemoryBuckets) {
      const fresh = values.filter((t) => t > windowStart)
      if (fresh.length === 0) inMemoryBuckets.delete(key)
      else inMemoryBuckets.set(key, fresh)
    }
  }
  return exceeded
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
    // FAIL CLOSED (batch 2): Upstash unreachable. Fall back to the
    // per-instance in-memory window; log the outage so it is visible in
    // Vercel Logs rather than silently degrading to no limiting at all.
    logWarn('ratelimit', 'upstash_unreachable_fail_closed', { route: opts.route })
    for (const key of keys) {
      const inMemoryKey = `${opts.route}:${key}`
      if (checkInMemory(inMemoryKey, IN_MEMORY_MAX_PER_MINUTE)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      }
    }
    // In-memory window not exceeded yet: allow this request, but the next
    // ones in the same minute may hit the fallback cap.
    return null
  }
}
