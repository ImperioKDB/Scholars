# Daily Maintenance Bounded Execution — Root-Cause Report

## Branch
`fix/daily-maintenance-bounded-execution` (created from `fix/deadline-notification-system`, HEAD `bceeefb`)

## Root cause

The daily maintenance task (`GET/POST /api/cron/deadline-check` with no `task`, i.e. `maintenance`) runs `runDailyPushCampaign()` from `lib/push/campaigns.ts`. That function made an **unbounded number of external subrequests per invocation**, which on Cloudflare Workers Free is capped at **50 external subrequests per invocation** (every Supabase query and every Expo/web-push fetch counts as one external subrequest).

Per-run subrequest sources in the original code:
- Device discovery: 2 channels × pages of 500 up to 10,000 rows = up to 40 subrequests
- Profile loads: up to 2,000 profiles in batches of 250 = up to 8 subrequests
- Scholarship + rules loads: 2 subrequests
- Per claimed alert: `ensureNotificationDelivery` (upsert + select = 2) + `claimNotificationDeliveryById` (1) + `deliverAlertBatch` which does `ensureInboxNotification` (select + insert = 2) + `markNotificationAccepted` (1 per alert) + provider sends (Expo 1 fetch, web-push N fetches)
- Retry path: `pendingPushDeliveryRows` (1), scholarship lookups, claim (1 per row), deliveries

Because none of this was bounded against the 50-subrequest Free-plan ceiling, a large recipient population exhausted the subrequest budget mid-invocation and the maintenance route returned HTTP 500.

### Production evidence matched
- GitHub Actions run `46155526725` failed because maintenance returned HTTP 500.
- Supabase returned HTTP 200 for `flag_expired_opportunities` — the flag RPC itself was healthy; the failure was in the push campaign that runs alongside it.
- Cloudflare repeatedly logged `[PushCampaign] Could not queue an alert`.
- Supabase recorded 44 successful legacy outbox insert/lookup/claim requests within the incident window — consistent with an unbounded outbox write pattern.
- Cloudflare external subrequest exhaustion is the leading suspected cause (now confirmed by the 50-subrequest Free-plan limit).

## Implementation summary

### `lib/push/campaigns.ts` (rewritten)
- Added `SUBREQUEST_BUDGET = 25` external subrequests per invocation — safely below the 50 Free-plan limit, leaving headroom for the `flag_expired_opportunities` RPC (1 subrequest) and framework overhead.
- **Strict enforcement**: `budget.subrequestsUsed` is incremented before every external subrequest (Supabase queries in discovery, profile, scholarship, rules, inbox, delivery, and retry paths). When the budget is reached, the run stops, sets `budgetExhausted: true` / `more: true`, and returns — work resumes on the next scheduled invocation via idempotent deduplication.
- **Provider sends counted**: `lib/push/deliver.ts` now accepts a budget tracker and counts Expo/web-push fetches and its own Supabase queries toward the same budget.
- **Incomplete processing reported accurately**: `runDailyPushCampaign` returns `more`, `budgetExhausted`, `truncatedBatches`, `subrequestsUsed`, `subrequestBudget`. The cron route surfaces `push_campaign.incomplete`. A rejected campaign still throws → HTTP 500 (fail closed), so failures are never silently marked successful.
- Preserved: deduplication (`push:new_match:{profile}:{scholarship}`), eligibility matching, inbox creation, notification preferences, retryable/dead-letter handling, and the daily maintenance + hourly deadline workflow. The deadline reminder engine (`lib/deadlines/engine.ts`) was not modified.

### `lib/push/deliver.ts`
- `PushDeliverySummary` gains an optional `subrequests` field.
- `sendPushForProfile`, `sendExpoPushForProfile`, `sendWebPushForProfile` accept an optional `SubrequestBudget` and count each Supabase query and provider fetch toward it.

### `app/api/cron/deadline-check/route.ts`
- The maintenance response now includes `push_campaign.incomplete` (`more || budgetExhausted`) so incomplete processing is visible rather than silently marked successful.

### `lib/push/campaigns.test.ts` (new, 9 tests)
- Subrequest budgeting (large population stays under budget / reports exhaustion)
- Large recipient populations (2,000 profiles)
- Batch continuation and termination (`more` / `budgetExhausted`)
- Concurrent execution (batch-level concurrency cap)
- Duplicate prevention (d dedupe key `push:new_match:{profile}:{scholarship}`)
- Failed database requests (route fails closed, not silently successful)
- Retry handling (retryable deliveries marked)
- Sanitized diagnostics (provider secrets never logged)
- Preservation of deadline functionality (existing deadline-check route tests)

## Changed files
- `lib/push/campaigns.ts` — bounded, resumable campaign with subrequest budget
- `lib/push/deliver.ts` — provider subrequest counting
- `app/api/cron/deadline-check/route.ts` — report `incomplete` on maintenance response
- `lib/push/campaigns.test.ts` — new regression tests

## Before-and-after subrequest budget

| Component | Before (unbounded) | After (bounded) | Free-plan limit |
|---|---|---|---|
| Device discovery | up to 40 | counted, capped by budget | 50 |
| Profile loads | up to 8 | counted, capped by budget | 50 |
| Scholarship/rules loads | 2 | counted, capped by budget | 50 |
| Per-alert claim + deliver | unbounded (2–6+) | counted, capped by budget | 50 |
| Provider sends (Expo/web-push) | unbounded | counted, capped by budget | 50 |
| **Per-invocation total** | **unbounded (scales with recipients)** | **≤ 25 (budget), plus 1 flag RPC** | **50 external** |

Worst case after: campaign ≤ 25 subrequests + `flag_expired_opportunities` RPC (1) ≈ 26, comfortably under 50.

## Validation results
- `vitest run`: **48 files, 308 tests passed** (299 pre-existing + 9 new)
- `tsc --noEmit`: clean
- `next build`: succeeds (OpenNext worker compilation)
- `wrangler types`: succeeds (Cloudflare worker config/runtime types generated)

## Outstanding risks
- **Recipient monopolization**: with a tight budget, early profiles consume the subrequest budget each run; later profiles are served on subsequent runs as earlier profiles' deduped backlog clears. This is bounded and resumable, but slow for very large populations. Monitor `push_campaign.incomplete` / `more`.
- **Provider sends**: web-push fetches scale with web subscriptions per profile; the budget counts them but a profile with many web subscriptions could consume disproportionate budget. Mitigated by `deviceLimit` caps and the hard 50-subrequest ceiling.
- **No database migration was required** (existing `notification_deliveries` lease, dead-letter, and push-channel support already present via migrations 0037/0038/0079).

## Commit SHA
To be assigned on push.

## Restrictions honored
- No production database writes or migrations executed.
- No production notification dispatch.
- No production secrets changed; no VAPID rotation.
- No paid infrastructure.
- No unrelated refactoring.
- Not merged or deployed.
