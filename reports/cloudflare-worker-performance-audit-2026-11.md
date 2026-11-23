# Scholars — Cloudflare Worker Performance Audit

Generated: 2026-11-23 11:54:34 UTC
Repository: `ImperioKDB/Scholars`
Source branch: `main`
Audit branch: `audit/cloudflare-performance-2026-11`

## 1. Audit scope

This is a read-only source-code audit. No application source files were modified.

This report identifies potential performance risks. Static source inspection cannot establish the exact CPU consumption of a deployed Worker. Runtime profiling and Cloudflare telemetry are required to confirm causality.

## 2. Runtime dependencies

- **next:** `15.5.29`
- **react:** `^18.3.1`
- **open-next:** `1.20.18`
- **wrangler:** `^4.166.0`
- **upstash-redis:** `^1.34.3`
- **supabase:** `^2.45.0`

## 3. Retrieved source files

- `app/api/presence/heartbeat/route.ts` — SHA `9befe5d9ea5d69453df5f85cea8238c99efcfe69`
- `app/api/scholarships/[id]/route.ts` — SHA `0fd6831c0d9680f40d9823fd5cadd554849c3481`
- `app/api/scholarships/match/route.ts` — SHA `d2ba8c438bd4466f72f0dfebfff08bc77c957f0a`
- `app/api/scholarships/route.ts` — SHA `ae72bcadacb69ff24c8020b7c4cce9b3e263e4c6`
- `app/scholarship/[slug]/page.tsx` — SHA `59ddaccc7299a0377463a3a66c917c3cb1843252`
- `app/scholarships/[id]/ScholarshipDetailClient.tsx` — SHA `725dd2a42154284701422aeb2471ae5f2d4faebb`
- `app/scholarships/[id]/page.tsx` — SHA `886d0757c9c7f3b691431ee1b55c2f885758d34b`
- `lib/matching/engine.ts` — SHA `1351509ec026cdbeb6b421c920bc1f2f449a2b7d`
- `lib/matching/getMatches.ts` — SHA `e180313a45a2dba66c6130ffc9986b2ec8c107c2`
- `lib/matching/matchCache.ts` — SHA `f7af2e698efc5166d5560a8395f87f320465e006`
- `lib/ratelimit.ts` — SHA `e7f61bea082de63b159929db0537ffe96a04154c`
- `lib/scholarship-community.ts` — SHA `9184324930b97b2f5a9ccafcbf13535dd3f0bcfe`
- `lib/supabase/currentUser.ts` — SHA `563fa4f03466107faacac9d0fd5241b2991a0a35`
- `lib/supabase/server.ts` — SHA `0070a5147454246ccd6aced990f851e67a70f568`
- `lib/supabase/service.ts` — SHA `964995bcd16a1cec86c6e8bbb07f9fb0e600f615`
- `middleware.ts` — SHA `a7171ac225e9629f9badd0672377dffecc748090`
- `next.config.js` — SHA `0f2412680ff01b86a349e0fe0725f2f7e80dcb00`
- `open-next.config.ts` — SHA `ffd9887857ebadf4c8670b577f99de6eba1f776b`
- `package.json` — SHA `8645a373c713132794cec80deaabe71e9c933aaf`
- `wrangler.jsonc` — SHA `b43020b9a717b793db7ca5d9e18fbbb603902c9c`

## 4. Findings

### 1. [INVESTIGATE] Dynamic scholarship detail rendering

The route explicitly disables static rendering. Profile the Next.js rendering path and determine whether public data can be cached separately from authenticated user-specific data.

Evidence:
- `app/scholarships/[id]/page.tsx`

### 2. [INVESTIGATE] Sequential rate-limit checks

Multiple rate-limit keys are processed sequentially. Measure the effect on latency and verify whether the route's CPU usage is affected. Network wait time is not equivalent to Worker CPU time.

Evidence:
- `lib/ratelimit.ts`

### 3. [INVESTIGATE] Authentication work in middleware

Inspect whether authentication calls are repeated across routes and whether the middleware matcher covers unnecessary public assets or routes.

Evidence:
- `middleware.ts`

### 4. [OPTIMIZATION CANDIDATE] Sequential similar-scholarship fallback

The route may execute a second database query after the first query returns no results. Investigate combining the lookup or using a single bounded query without changing results.

Evidence:
- `app/scholarships/[id]/page.tsx`

### 5. [OPTIMIZATION CANDIDATE] Community discussion payload

The community loader requests up to 100 discussions. Review actual payload sizes and whether the initial detail page needs the entire collection.

Evidence:
- `lib/scholarship-community.ts`

### 6. [PROFILE] Scholarship ranking computation

The matching engine performs scholarship evaluation and ranking. Measure CPU against real catalog size and profile data before considering any changes.

Evidence:
- `lib/matching/getMatches.ts`

## 5. Additional observations

- Next.js configuration was retrieved.
- OpenNext Cloudflare configuration was retrieved.
- Wrangler JSONC configuration was retrieved.
- app/api/presence/heartbeat/route.ts: Date object construction (1 occurrence(s))
- app/api/scholarships/match/route.ts: request JSON parsing present.
- app/scholarship/[slug]/page.tsx: Date object construction (1 occurrence(s))
- app/scholarships/[id]/ScholarshipDetailClient.tsx: Date object construction (1 occurrence(s))
- app/scholarships/[id]/ScholarshipDetailClient.tsx: JSON serialization (2 occurrence(s))
- app/scholarships/[id]/page.tsx: concurrent asynchronous operations already exist.
- lib/matching/engine.ts: Array sorting (1 occurrence(s))
- lib/matching/engine.ts: Date object construction (4 occurrence(s))
- lib/matching/getMatches.ts: Loop requiring complexity review (2 occurrence(s))
- lib/matching/getMatches.ts: match-cache integration exists.
- lib/matching/matchCache.ts: Redis client initialization is present.
- lib/scholarship-community.ts: Array sorting (1 occurrence(s))
- middleware.ts: JSON serialization (2 occurrence(s))
- middleware.ts: Loop requiring complexity review (4 occurrence(s))

## 6. Retrieval warnings

No retrieval warnings.

## 7. Recommended investigation order

- Correlate the original Ray ID with Cloudflare Worker telemetry and identify the exact route and execution outcome.
- Measure CPU time for scholarship detail page rendering, middleware and matching operations independently.
- Profile scholarship ranking against realistic catalog sizes.
- Investigate dynamic rendering and determine whether public scholarship data can be safely cached independently of personalized data.
- Measure community query payload size and execution paths.
- Review rate-limiting middleware and external service failure behavior without removing security controls.
- Create regression tests before changing any application code.
- Deploy optimization changes to a separate test environment and compare CPU time, response latency and error rates.

## 8. Safety constraints

- Do not weaken authentication.
- Do not expose personalized data through shared caches.
- Do not change scholarship eligibility rules.
- Do not remove rate limiting.
- Do not silently change API response contracts.
- Do not remove existing application features.

End of report.
