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
- Both cron entry points use the same ten-minute owner lease and phase checks. PostgreSQL claims up to four profiles and five rows per profile in a delivery batch. It rechecks listing freshness and device opt-in, and fences outcome writes by lease and owner. Deferred retries stay in the shared outbox and can run after a discovery window completes.
- Each delivery bundle allows four devices per channel. The upper bound is three Expo requests and six Web Push requests per bundle, plus begin, claim, finish, and the optional maintenance flag RPC. This includes the outcome write before sending begins. The cap applies to application requests with PostgREST retries disabled on the campaign and device calls. Runtime CPU and provider reachability are outside the scope of a build dry-run.
- If a provider accepts a push but the Worker loses its outcome write, the expired send is recorded as `unknown`. The engine avoids an automatic duplicate by accepting the possibility that some interrupted pushes never reached the provider. The inbox intent survives.
- The workflow runs daily maintenance before new-match continuation and drains the campaign hourly, independently of deadline preparation.

The migration depends on the existing deadline and progress migrations. It preserves existing outbox rows and dedicates new-match push claims to this engine. When these SQL changes are applied, callers on the previous Worker revision can no longer claim new-match pushes through the generic claim RPC. The migration has been exercised only in disposable PostgreSQL.

## Verification

Run `bash scripts/test-new-match-campaign.sh` for the isolated PostgreSQL integration suite. It invokes the application orchestration against separate database sessions with mocked providers, including 2,000 synthetic recipients, a deleted cursor row, concurrent entry points, expired owners, failed inbox and outcome persistence, and legacy outbox deduplication.
