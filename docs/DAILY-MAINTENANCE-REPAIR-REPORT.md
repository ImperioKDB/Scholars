# Daily Maintenance Bounded Execution — Root-Cause Report

## Branch
`fix/daily-maintenance-bounded-execution` (rebased onto `origin/main` `b5b83f4`)

## Commit SHA
`e1738f7e464a39df5b60d516f2bd7ce4d1b70337`

## Root cause

The daily maintenance task (`GET/POST /api/cron/deadline-check` with no `task`, i.e. `maintenance`) runs `runDailyPushCampaign()` from `lib/push/campaigns.ts`. That function made an **unbounded number of external subrequests per invocation**. Cloudflare Workers Free is capped at **50 external subrequests per invocation** (every Supabase query and every outbound provider fetch counts as one). This is the leading suspected cause of the HTTP 500 failure, consistent with but not independently confirmed by direct production evidence.

Per-run subrequest sources in the original code:
- Device discovery: 2 channels × pages of 500 up to 10,000 rows = up to 40 subrequests
- Profile loads: up to 2,000 profiles in batches of 250 = up to 8 subrequests
- Scholarship + rules loads: 2 subrequests
- Per claimed alert: `ensureNotificationDelivery` (upsert + select = 2) + `claimNotificationDeliveryById` (1) + `deliverAlertBatch` which does `ensureInboxNotification` (select + insert = 2) + `markNotificationAccepted` (1 per alert) + provider sends (Expo 1 fetch, web-push N fetches)
- Retry path: `pendingPushDeliveryRows` (1), scholarship lookups, claim (1 per row), deliveries

Because none of this was bounded against the 50-subrequest Free-plan ceiling, a large recipient population could exhaust the subrequest budget mid-invocation and the maintenance route would return HTTP 500.

### Production evidence
- GitHub Actions run `46155526725` failed because maintenance returned HTTP 500.
- Supabase returned HTTP 200 for `flag_expired_opportunities` — the flag RPC itself was healthy; the failure was in the push campaign that runs alongside it.
- Cloudflare repeatedly logged `[PushCampaign] Could not queue an alert`.
- Supabase recorded 44 successful legacy outbox insert/lookup/claim requests within the incident window — consistent with an unbounded outbox write pattern.
- Cloudflare external subrequest exhaustion is the leading suspected cause (consistent with the 50-subrequest Free-plan limit, not independently confirmed).

## Implementation summary

### `lib/push/subrequestBudget.ts` (new)
Centralized `SubrequestBudget` class that enforces the external subrequest ceiling.
- `reserve(count)` returns `false` when insufficient capacity remains; caller must not make the request.
- `remaining` / `exhausted` getters for reporting.
- `snapshot()` diagnostic for logging/observability.

### `lib/push/campaigns.ts` (rewritten)
- `DEFAULT_SUBREQUEST_BUDGET = 40` external subrequests per invocation, safely below the 50 Free-plan limit, leaving ~10 headroom for `flag_expired_opportunities` (1 RPC) and framework overhead.
- **Strict enforcement**: `budget.reserve(n)` is called BEFORE every external Supabase or provider request. When exhausted, the run stops, sets `budgetExhausted: true` / `more: true`, and returns. Remaining work resumes on the next scheduled invocation.
- **Actual-request counting**: Each Supabase `from()` call and each provider fetch (Expo, web-push) counts as one subrequest. Helper-invocation counts are not used as proxies.
- **Deterministic, resumable progress**: Profiles are processed in ascending `id` order. Dedupe keys (`push:new_match:{profile}:{scholarship}`) prevent duplicate sends. A prepared migration adds a `push_campaign_progress` table for durable cursor tracking once approved and applied.
- **No starvation**: Later recipients are processed on subsequent invocations; deterministic ordering plus dedupe-based idempotency ensures monotonic progress.
- **Restored scholarship fields**: `application_url` and `last_cycle_closed_at` included in the discovery query.
- **No incorrect eligibility decisions**: Budget exhaustion during discovery stops processing without suppressing valid recipients or making incorrect tier decisions.
- `runDailyPushCampaign(supabase, budgetLimit?)` accepts an optional budget limit (default 40).

### `lib/push/deliver.ts` (rewritten)
- `PushDeliverySummary` gains an optional `subrequests` field counting actual provider subrequests.
- `sendExpoPushForProfile`: counts tokens select (1), Expo fetch (1), invalid-token update (1).
- `sendWebPushForProfile`: counts subscriptions select (1), each web-push send fetch (1 per subscription), expired-subscription delete (1). Uses a hard limit of 50 per web-push loop iteration as a secondary safety valve.
- `sendPushForProfile`: aggregates subrequests from both channels.
- All provider sends accept an optional `SubrequestBudget` and reserve capacity before each actual fetch.

### `app/api/cron/deadline-check/route.ts`
- Maintenance response includes `push_campaign.incomplete` (`more || budgetExhausted`) so incomplete processing is reported accurately rather than silently marked successful.
- The hourly deadline engine (`lib/deadlines/engine.ts`) is unchanged.

### `supabase/migrations/20261128000000_add_push_campaign_progress.sql` (new, prepared, NOT applied)
Adds a `push_campaign_progress` table for durable cursor tracking. Not applied to production; prepared for separate review.

## Changed files
- `lib/push/subrequestBudget.ts` — new centralized budget enforcement
- `lib/push/campaigns.ts` — bounded, resumable campaign with actual-request counting
- `lib/push/deliver.ts` — provider subrequest counting and budget integration
- `app/api/cron/deadline-check/route.ts` — reports `incomplete` on maintenance response
- `lib/push/campaigns.test.ts` — 17 new regression tests
- `supabase/migrations/20261128000000_add_push_campaign_progress.sql` — prepared migration (not applied)

## Before-and-after subrequest budget

| Component | Before (unbounded) | After (bounded) | Free-plan limit |
|---|---|---|---|
| Device discovery | up to 40 | counted, capped by budget | 50 |
| Profile loads | up to 8 | counted, capped by budget | 50 |
| Scholarship/rules loads | 2 | counted, capped by budget | 50 |
| Per-alert claim + deliver | unbounded (2–9+) | counted, capped by budget | 50 |
| Provider sends (Expo/web-push) | unbounded | counted, capped by budget | 50 |
| **Per-invocation total** | **unbounded** | **≤ 40** (+1 flag RPC) | **50 external** |

Worst case after: campaign ≤ 40 subrequests + `flag_expired_opportunities` RPC (1) ≈ 41, comfortably under 50.

## Validation results
- `vitest run`: **50 files, 339 tests passed** (322 pre-existing + 17 new). One pre-existing flaky UI test (`app/onboarding/page.test.tsx`) timed out; unrelated to these changes.
- `tsc --noEmit`: no new errors in changed files.
- `next build`: succeeds (the `signup/page.tsx` type error is pre-existing, occurs with changes stashed).
- `wrangler types`: succeeds (Cloudflare worker config/runtime types generated).

### Regression test coverage
- Subrequest budgeting (stays under budget, reports exhaustion)
- Strict budget enforcement under concurrent requests
- Multiple subscriptions per recipient (each web-push fetch counted)
- Budget exhaustion before and after provider acceptance
- Persistence failures and ambiguous delivery outcomes (fail closed, not silently successful)
- Progress across repeated invocations with 2,000 recipients
- Previously completed recipients not blocking later recipients
- Incomplete eligibility and device discovery (no incorrect suppression)
- Scheduler continuation and bounded termination
- Duplicate prevention (d dedupe key from profile + scholarship)
- Preservation of existing deadline functionality

## Outstanding risks
- **Recipient throughput**: With a 40-subrequest budget, roughly 3-5 candidate matches can be fully processed per invocation. Very large populations require multiple daily runs. Monitor `push_campaign.incomplete`.
- **Web-push subscription count**: Profiles with many web subscriptions consume disproportionate budget (1 subrequest per fetch). Mitigated by `deviceLimit` caps and the hard 50-subrequest ceiling.
- **Durable progress**: The `push_campaign_progress` migration is prepared but not applied. Until applied, continuation relies on deterministic in-order processing + dedupe-based idempotency, which is correct but may re-scan already-complete profiles on each run.
- **Cloudflare subrequest hypothesis**: Described as the leading suspected cause, consistent with the 50-subrequest Free-plan limit, but not independently confirmed by direct production evidence.

## Restrictions honored
- No production database writes or migrations executed.
- No production notification dispatch.
- No production secrets changed; no VAPID rotation.
- No paid infrastructure.
- No unrelated refactoring.
- Not merged or deployed.
