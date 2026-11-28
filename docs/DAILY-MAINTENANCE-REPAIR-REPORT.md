# Daily Maintenance Bounded Execution — Root-Cause Report

## Branch
`fix/daily-maintenance-bounded-execution` (rebased onto `origin/main` `b5b83f4`)

## Commit SHA
`c2ddda97fa1b509a4984c17b47f3b8d3c8443ee7`

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

### Three-phase architecture

The campaign is now separated into three independently bounded phases:

**Phase 1 — Discovery:** Selects eligible recipients in deterministic pages (250 profiles per page), evaluates scholarship eligibility via `rankScholarships`, and persists deduplicated delivery intents via `ensureNotificationDelivery`/`claimNotificationDeliveryById`.

**Phase 2 — Delivery:** Claims a bounded number of pending intents (25 per batch), creates inbox notifications, delivers pushes via `sendPushForProfile`, and persists outcomes (`markNotificationAccepted`/`markNotificationRetryable`).

**Phase 3 — Continuation:** Persists campaign progress to the `push_campaign_progress` table so subsequent invocations resume unfinished work without restarting discovery.

### `lib/push/subrequestBudget.ts` (new)
Centralized `SubrequestBudget` class enforcing the external subrequest ceiling.
- `reserve(count)` returns `false` when insufficient capacity remains
- `remaining` / `exhausted` getters for reporting
- `snapshot()` diagnostic for observability

### `lib/push/campaigns.ts` (rewritten)
- `DEFAULT_SUBREQUEST_BUDGET = 40` external subrequests per invocation (safely below 50 Free-plan limit, ~10 headroom for `flag_expired_opportunities` + framework)
- **Strict enforcement**: `budget.reserve(n)` called BEFORE every external Supabase/provider request
- **Actual-request counting**: each Supabase call and each provider fetch counts as one subrequest
- **Deterministic, resumable progress**: profiles processed in ascending `id` order; dedupe keys (`push:new_match:{profile}:{scholarship}`) prevent duplicate sends
- **Restored scholarship fields**: `application_url` and `last_cycle_closed_at` included in discovery query
- **No incorrect eligibility decisions**: budget exhaustion during discovery stops without suppressing valid recipients
- `runDailyPushCampaign(supabase, budgetLimit?)` accepts optional budget limit

### `lib/push/deliver.ts` (rewritten)
- `PushDeliverySummary` gains optional `subrequests` field counting actual provider subrequests
- `sendExpoPushForProfile`: counts tokens select (1), Expo fetch (1), invalid-token update (1)
- `sendWebPushForProfile`: counts subscriptions select (1), each web-push send fetch (1 per subscription), expired-subscription delete (1); hard limit of 50 per web-push loop iteration as secondary safety valve
- `sendPushForProfile`: aggregates subrequests from both channels

### `app/api/cron/deadline-check/route.ts`
- Added standalone `new_match` task that runs only `runDailyPushCampaign` (no opportunity flagging)
- Maintenance response includes `push_campaign.incomplete` (`more || budgetExhausted`)
- Hourly deadline engine unchanged

### `.github/workflows/digest-cron.yml`
- Added `drain_new_match` function that repeatedly calls `new_match` task until `push_campaign.incomplete` is false
- Drains new_match in parallel with push/email channels (16 batches, 720s window)
- Maintenance task continues to handle daily flagging + first new-match batch

### `supabase/migrations/20261128000000_add_push_campaign_progress.sql` (new, prepared, NOT applied)
- `push_campaign_progress` table with unique campaign identity (`kind` constraint)
- Concurrency safety via PostgreSQL advisory locks (`try_claim_push_campaign`, `release_push_campaign`, `reclaim_stale_push_campaign`)
- Explicit permissions: RLS enabled, service-role only, no public access
- Indexes on `(kind, lease_until)` and `(kind, updated_at desc)`
- Stale-lease recovery for crashed invocations
- NOT applied to production; prepared for separate review

## Changed files
- `lib/push/subrequestBudget.ts` — new centralized budget enforcement
- `lib/push/campaigns.ts` — three-phase bounded campaign with actual-request counting
- `lib/push/deliver.ts` — provider subrequest counting and budget integration
- `app/api/cron/deadline-check/route.ts` — added `new_match` task, reports `incomplete`
- `.github/workflows/digest-cron.yml` — added `drain_new_match` continuation loop
- `lib/push/campaigns.test.ts` — 17 regression tests
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
- `vitest run`: **50 files, 339 tests passed** (339 total, 17 new). All green.
- `tsc --noEmit`: no errors in changed files (pre-existing errors in unrelated files only)
- `next build`: succeeds for changed code; pre-existing `signup/page.tsx` type error (unrelated, occurs with changes stashed)
- `wrangler types`: succeeds (Cloudflare worker config/runtime types generated)

### Regression test coverage (17 tests)
- Subrequest budgeting: stays under budget, reports exhaustion
- Strict budget enforcement under concurrent requests
- Multiple subscriptions per recipient: each web-push fetch counted individually
- Budget exhaustion before and after provider acceptance: leases preserved, not silently accepted
- Persistence failures: fail closed, not silently successful
- Ambiguous delivery outcomes: marked retryable, not accepted
- 2,000 recipients across multiple bounded runs: no starvation
- Previously completed recipients don't block later recipients
- Incomplete eligibility/device discovery: no incorrect suppression
- Scheduler continuation: reports incomplete, terminates boundedly
- Duplicate prevention: dedupe key from profile + scholarship
- Deadline functionality preservation: engine interface unchanged

## Outstanding risks
- **Recipient throughput**: ~3-5 candidate matches fully processed per invocation at 40-subrequest budget. Large populations require multiple daily runs. Monitor `push_campaign.incomplete`.
- **Web-push subscription count**: profiles with many web subscriptions consume disproportionate budget (1 per fetch). Mitigated by `deviceLimit` caps and hard 50-subrequest ceiling.
- **Durable progress**: migration prepared but not applied. Until applied, continuation relies on deterministic in-order processing + dedupe-based idempotency (correct but may re-scan complete profiles).
- **Cloudflare subrequest hypothesis**: leading suspected cause, consistent with 50-subrequest Free-plan limit, not independently confirmed by direct production evidence.

## Restrictions honored
- No production database writes or migrations executed.
- No production notification dispatch.
- No production secrets changed; no VAPID rotation.
- No paid infrastructure.
- No unrelated refactoring.
- Not merged or deployed.
