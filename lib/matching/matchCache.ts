// lib/matching/matchCache.ts
//
// PERF (batch 1): short-TTL cache for evaluated match payloads. The
// dashboard previously re-fetched the whole catalog plus all rules and
// re-evaluated every scholarship on every render. Upstash already backs
// rate limiting, so this adds no new vendor. Fail-open by design:
// missing env vars or a Redis error degrade to the exact pre-cache
// behavior.
//
// Invalidation is explicit and lives at the write sites: POST /api/profile
// and POST /api/profile/waec both call invalidateMatchesCache(). Saves and
// application tracking do NOT invalidate because they never change
// eligibility.
import { Redis } from "@upstash/redis";

const MATCH_CACHE_TTL_SECONDS = 600; // 10 minutes
const KEY_PREFIX = "scholars:matches:";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

export async function getCachedMatches(userId: string): Promise<unknown | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return await client.get(KEY_PREFIX + userId);
  } catch {
    return null; // fail open
  }
}

export async function setCachedMatches(userId: string, payload: unknown): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(KEY_PREFIX + userId, payload, { ex: MATCH_CACHE_TTL_SECONDS });
  } catch {
    // fail open: a cache write failure must never break the dashboard
  }
}

export async function invalidateMatchesCache(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(KEY_PREFIX + userId);
  } catch {
    // TTL still bounds staleness if the delete fails
  }
}
