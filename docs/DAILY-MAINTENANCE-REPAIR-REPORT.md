# Daily new-match campaign repair

The source review used branch head `c571dadac84f9e739249d6977481c51a0f8198ff` and baseline `b5b83f4`. The earlier report named a different commit. The route, workflow, migration and 17 tests below refer to the supplied branch head.

| Earlier claim | Source review |
| --- | --- |
| The legacy fan-out could exceed the Worker subrequest limit | Confirmed from its call graph. Device and profile reads, inbox writes, outbox claims, and provider sends had individual limits or concurrency controls, with no shared bound. The incident's production logs, prior command results, and root cause could not be established from repository source. |
| All requests fit the new 40-request budget | The branch had a per-call budget for much of the work and counted Web Push sends individually. Progress used two independent module-level budgets, the maintenance flag RPC ran separately, and the provider path could run out of capacity before persisting acceptance. The reported secondary 50-send Web Push cap was absent. |
| Discovery was deterministic, paged and resumable | Device scans used offsets and caps, profile loads were batched, and the scholarship query selected both application-window columns. Both progress writes used a null cursor, and scholarship windows were recalculated on each invocation. A partial device or scholarship read could feed the suppression path. |
| The campaign used separate phases and locked continuation | Execution ran discovery, new sends and retries in the same call regardless of persisted phase. Both cron tasks invoked the same pipeline while the workflow could run them concurrently. The progress lease helpers had no callers. Acquiring the transaction advisory lock could overwrite a live row lease, and release checked the kind alone. |
| The route and workflow provided continuation | The standalone POST task and bounded scheduler loop existed. Maintenance was also exposed via the legacy unqualified GET, and the workflow gated continuation on successful deadline preparation. The deadline engine source was unchanged. |
| Seventeen regression tests established continuation and concurrency safety | The file contained 17 tests. They used in-memory mocks and did not establish cross-session lease ownership, atomic enqueue and cursor movement, durable windows, or eventual coverage of the real database query. |

## Implementation

- Maintenance captures one UTC discovery window per day. It stores the 48-hour verification bounds, profile ID ceiling, up to 250 candidate scholarships, and their rules. Continuation takes the oldest unfinished window. A later maintenance request can capture its own window while an earlier one is still open.
- The Worker uses the existing profile mapper and ranking engine. It keeps the top five matches above the `unlikely` tier and the existing `push:new_match:{profile}:{scholarship}` key. A keyset page scans up to 100 profiles, with smaller pages for larger scholarship and rule sets. PostgreSQL commits the inbox rows, outbox intents, and cursor together. The cursor advances even when a page has zero opted-in profiles.
- Both cron entry points use the same ten-minute owner lease and phase checks. PostgreSQL claims up to four profiles and five rows per profile in a delivery batch. It rechecks current listing availability, verification freshness and device opt-in, and fences outcome writes by lease and owner. Deferred retries stay in the shared outbox and can run after a discovery window completes.
- Each delivery bundle allows four devices per channel. The upper bound is three Expo requests and six Web Push requests per bundle, plus begin, claim, finish, and the optional maintenance flag RPC. This includes the outcome write before sending begins. The cap applies to application requests with PostgREST retries disabled on the campaign and device calls. Runtime CPU and provider reachability are outside the scope of a build dry-run.
- If a provider accepts a push but the Worker loses its outcome write, the expired send is recorded as `unknown`. The engine avoids an automatic duplicate by accepting the possibility that some interrupted pushes never reached the provider. The inbox intent survives.
- The workflow runs daily maintenance before new-match continuation and drains the campaign hourly, independently of deadline preparation.

## Delivery outcomes

The claim checks the live scholarship row just before handing a bundle to the sender. Unverified, expired, not-yet-open, and closed-cycle listings are suppressed. The availability check uses the Africa/Lagos calendar, including the deadline and opening dates and excluding the cycle-closure date. Null dates still mean no corresponding restriction. The seven-day verification freshness gate remains in place.

An explicit permanent rejection, including HTTP 403, is recorded as `failed`. Temporary rejections such as HTTP 429 and 503 can retry after ten minutes, up to three total attempts per delivery. PostgreSQL moves exhausted retries to `dead_letter`, including eligible legacy rows that have already spent their allowance. Transport failures with uncertain acceptance, HTTP 408, missing Expo tickets, and interrupted engine sends become `unknown` and are excluded from automatic replay. A known acceptance on either channel takes precedence over other results for the bundle.

## Migration and Worker cutover

Compatibility was reviewed against the pre-PR Worker source on `main` at `b5b83f4`, including its generic claim and direct suppression paths, and verified at the RPC boundary in disposable PostgreSQL. The active production Worker version and migration ledger were unavailable for direct inspection. Confirm both before a real cutover.

| Migration | Compatibility with the pre-PR Worker |
| --- | --- |
| `20261128000000_add_push_campaign_progress.sql` | Adds the draft progress table, indexes and helpers. The pre-PR Worker uses none of them. Its legacy new-match claim remains callable. |
| `20261128010000_new_match_campaign_engine.sql` | Requires the progress migration and the deadline migration `20261127000000` (including its `unknown` status). It adds the engine schema and service-role RPCs, retires access to the draft progress helpers and excludes new-match push rows from the generic claim. The pre-PR Worker can still claim unrelated legacy campaigns. Its new-match campaign cannot claim through that RPC, but can still directly suppress queued or leased rows, so old and new campaign entry points must never overlap. |

1. Check the actual Worker build, migration ledger, and RPC signatures against staging or a production-schema copy. Check every caller of daily maintenance, including scheduled or manual workflow runs and legacy unqualified GET. If an earlier revision of the engine migration is already recorded, prepare a forward migration for that schema before proceeding.
2. Pause all new-match and maintenance callers. Wait for old requests to finish and let active legacy leases drain or expire. Investigate unresolved legacy claims that could have sent and quarantine ambiguous rows before allowing retries. Keep these callers paused throughout cutover.
3. Apply the progress migration first, then the engine migration, each transactionally. Verify both migration records and RPC grants, confirm that the generic claim rejects new-match pushes, and check that deadline and unrelated legacy claims remain available.
4. Deploy the matching Worker after both migrations. Verify route and RPC behavior in staging with isolated data and mock providers, then resume one scheduler against the new Worker. The new Worker depends on the engine RPCs. The old Worker cannot process new-match pushes safely after the engine migration.

For rollback, pause and drain callers again. Rolling back only the Worker leaves the legacy claim fenced and can still expose the queue to the legacy suppression path if maintenance is resumed. Keep new-match maintenance paused if rolling back the rest of the app. To resume the old campaign, first investigate any engine-owned sends whose acceptance is uncertain, record unresolved ones as `unknown`, and ensure no engine requests or live leases remain. Use a reviewed forward migration to restore the pre-PR `claim_notification_delivery` definition and grants from `20261127000000` before re-enabling the legacy scheduler. Preserve the schema, dedupe history, inbox rows, and terminal outcomes for recovery. A legacy rollback restores the old campaign limitations; a forward fix keeps the bounded retry and availability checks.

## Verification

Run `bash scripts/test-new-match-campaign.sh` for the isolated PostgreSQL integration suite. It invokes the application orchestration against separate database sessions with mocked providers, including 2,000 synthetic recipients, a deleted cursor row, concurrent entry points, expired owners, failed inbox and outcome persistence, and legacy outbox deduplication.
