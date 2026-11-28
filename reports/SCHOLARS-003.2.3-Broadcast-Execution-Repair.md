# SCHOLARS-003.2.3 — P0 Broadcast Execution Repair

**Status:** Implementation and qualification · **Branch:** `fix/cloudflare-broadcast-execution` · **Baseline:** upstream `main` at `9c403c3`, which includes PR #48.

## Incident finding

The current route exceeds the Workers Free subrequest limit by design. A 300-recipient email pass needs at least 300 provider calls, before authentication, Supabase, or push. Subrequest exhaustion is the leading explanation for these requests. The retained invocation logs lack a subrequest count or an explicit limit exception, and billing permissions prevented verification of the production Workers tier. The historical trigger remains unconfirmed. Cloudflare's `standard` usage-model field alone does not establish the tier. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [HTTP-request Logpush fields](https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/zone/http_requests/)

| November 27, 2026, WAT | Broadcast ID | Worker email summary | Supabase email rows | Worker push summary | Supabase push rows |
| --- | --- | --- | --- | --- | --- |
| 22:42:34 | `f3b105fa-8ad2-4e1f-a752-d444ed98c11b` | 291 recipients, 7 accepted, 284 uncertain network outcomes | 5 `sent` with message IDs | 55 profiles, 0 reported accepted | 5 `leased` |
| 22:44:16 | `746a5c6e-fcdf-48b2-9f24-a044491ed74c` | 300 recipients, 7 accepted, 293 uncertain network outcomes | 5 `sent` with message IDs | 78 profiles, 0 reported accepted | 5 `leased` |

Read-only Cloudflare queries correlated the application logs with each production invocation. Both returned HTTP 200 with invocation outcome `ok`. The logs report 398 ms and 1,106 ms of CPU and 8.661 s and 10.154 s wall time respectively. The successful invocation outcome and unavailable billing evidence leave those CPU measurements unexplained relative to the documented Free CPU allowance. There was no recorded CPU-limit termination. An HTTP 200 here confirms only that the admin route returned its summary. [Workers logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) · [Workers CPU and invocation limits](https://developers.cloudflare.com/workers/platform/limits/)

Every reported email failure in these requests was a Brevo `network_error` with `uncertain_outcome`, `networkErrorName: Error`, and no HTTP status. Each invocation separately logged two `sent_delivery_log_failed` events after provider acceptance, which explains the difference between seven reported acceptances and five stored records. The push handler records profile-level results after device work and can lose acceptance evidence when writes or a transport fail. An expired lease gives no answer about provider acceptance. [Broadcast route](../app/api/admin/broadcast/route.ts) · [Brevo adapter](../lib/email/providers/brevo.ts) · [Push runner](../lib/push/adminBroadcast.ts)

### Current request cost

| Work inside a single POST | Intended external calls |
| --- | --- |
| Setup | Normally one Upstash limit check, one middleware user lookup, two admin-guard calls, one or two listing reads, one paginated auth call per 100 users including the final empty page at an exact multiple, at least two push audience pages, and one profile read. Auth refresh, retry and additional audience pages add cost. With exactly 300 registered users, two listing kinds and one page per push table, this is roughly 13 calls before sends. |
| Email | One provider call and one delivery-log write per recipient, plus an announcement upsert per accepted profile and one extra provider request on eligible fallback. For 300 recipients, about 600 calls with failure logging, 900 if all are accepted and have profiles, or up to another 300 calls for fallback. |
| Push | Ordinarily six database requests per fully processed profile with both transports configured. Two ensure the intent, one claims it, two load devices and one finalizes it. Add up to one Expo request, one request per Web Push subscription and cleanup writes. At 78 profiles with one actionable device each, this is about 546 requests before cleanup. One profile can exceed 50 calls by itself because the Web Push lookup allows up to 100 devices. |

Combining the 300-email and 78-push examples gives about 1,146–1,446 calls before setup, fallback or cleanup. These are costs to complete the work. The actual invocations may have stopped reaching external services much earlier. Five email loops and five push loops limit parallel profile work while draining the entire audience. A push profile can open both transports and many Web Push requests at once. Workers Free allows 50 subrequests, six simultaneous connections waiting for response headers, 10 ms active CPU for HTTP and Cron invocations and 100,000 requests per day across the account. `maxDuration = 300` does not raise those limits. [Broadcast route](../app/api/admin/broadcast/route.ts) · [Push transport](../lib/push/deliver.ts) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)


## Implementation

The admin POST now validates the request and returns HTTP 202 with the persisted campaign and status URL. The `broadcast_enqueue` transaction snapshots verified listing content, the email recipients and the enabled push devices. It preserves A/B/C ordering, includes authenticated email users without a profile, and limits the selected push audience to 2,000 profiles. Duplicate addresses or endpoints within a campaign are recorded as unattempted. A submission UUID is required. Resubmitting that UUID resolves to the same campaign, and equivalent simultaneous submissions share an active campaign even if their UUIDs differ. The database applies the submission rate limit by authenticated administrator.

The existing OpenNext HTTP handler now shares its Worker entry point with two Cloudflare Queues consumers and a one-minute Cron Trigger. Each scheduled or queue handler bypasses Next.js and its authentication and middleware. Cron looks up due jobs, emits up to two wake messages and recovers database-backed work following message loss or a Worker restart. Email and push have independent jobs, leases and delivery state. Queue messages carry only a job ID. Delivery runs only when the `BROADCAST_CONSUMERS_ENABLED` binding equals `true`.

Each slice reserves one recipient or one device. A lease token fences the reservation. The database issues a distinct dispatch token and reserves the provider allowance before the worker makes the external request. An expired pre-dispatch reservation can resume. An expired dispatch intent becomes uncertain and is ineligible for resend. A late acceptance for that same intent can resolve the uncertainty. The worker retries the outcome write once with the same attempt token. Optional bookkeeping runs in a database subtransaction, so an announcement, push projection or cleanup failure does not roll back the accepted outcome. The worker logs a sanitized acceptance observation before the outcome write.

Brevo remains primary and Resend remains available for a confirmed Brevo 401 or 403 and as an explicitly configured primary when Brevo is absent. Fallback gets a separate durable dispatch reservation and invocation. Quota exhaustion and uncertain responses never trigger fallback. The worker sends a stable Brevo metadata correlation key and a stable Resend idempotency key. Expo tickets and Web Push responses establish provider acceptance. The admin view displays queued, processing, provider accepted, definitively rejected, uncertain, quota deferred, unattempted and bookkeeping error counts for email, push profiles and push devices. Batch controls and the existing provider tests remain available. Status reads can restore progress without creating work.

### Runtime and provider budgets

| Event | External operation budget |
| --- | --- |
| Admin POST or GET | A 12-call ceiling covers the Supabase SSR auth client, session refresh and retries, the admin profile check and one database RPC. The broadcast route performs the MFA check that applies to admin routes. Middleware keeps the canonical redirect and request handling, then delegates this exact route's network authentication to the route. |
| Cron | One due-work RPC and at most two queue binding calls. |
| Queue consumer | Normally 5 or 6 operations and at most 7 on the tested path. It can claim, register a dispatch intent, contact one provider, attempt the same outcome write twice, release the lease and publish one wakeup. |
| Provider fallback | A new email invocation with the same bounds and a separate provider reservation. |

The budget counts attempted requests including failed calls and queue binding operations. It sets redirects to manual, caps individual requests at four seconds, bounds JSON response reads, and reserves six operations before a provider request after the single claim. No queue slice opens more than one network operation at a time. The 32-operation ceiling leaves headroom below the 50-subrequest limit. One recipient per slice was chosen over the approved maximum batch sizes to limit active CPU and keep recovery straightforward. A 300-email and 78-device campaign normally needs roughly 378 wake messages, or about 1,134 Free Queue operations at one write, read and delete per message before duplicate and retry overhead.

The database serializes reservations for the same provider across campaigns. The email lane needs an operator-verified daily allocation for each provider and a monthly allocation for Resend. Windows with missing, overlapping or exhausted credits defer processing. Brevo daily allocations are capped at 300. Resend is capped at 100 daily and 3,000 monthly. Both email providers and the Expo transport start at one reserved dispatch per second. Web Push applies the same bound per origin. Documented rate and quota responses defer eligible recipients using provider timing, including `Retry-After`. Repeated uncertain outcomes open a 15-minute provider hold. External send paths share the provider account and consume headroom outside this ledger. Account for that usage before setting the verified allocation. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) · [Brevo quota](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) · [Resend quotas](https://resend.com/docs/api-reference/rate-limit)

## Migration and deployment

The additive migration is [20261127233336_durable_admin_broadcast.sql](../supabase/migrations/20261127233336_durable_admin_broadcast.sql). It adds campaign, submission, target and provider ledger tables, indexes and service-role RPCs. It reuses `workflow_jobs` and uses `notification_deliveries` for the per-profile push projection with a new discriminator. RLS is enabled on all new tables. Browser roles have neither table access nor RPC execution. The service-role wrappers invoke the few narrowly scoped functions that need to read `auth.users` from `broadcast_private`, which stays outside Supabase's exposed schemas. Both incident IDs are explicitly refused. Legacy broadcast and deadline rows are outside the worker's job and campaign selectors.

After separate rollout authorization:

1. Confirm the target account's Workers and Queue budgets, queue names and available cron slot. Run a provider-stubbed Cloudflare preview with the equivalent bundle and isolated database, check active CPU and observe the staging scheduler. Use the planned p99 target of 8 ms against the 10 ms Free CPU limit. Review startup and uncompressed bundle size when rebasing.
2. Apply the additive migration before directing admin traffic to the new endpoint. Provision `scholars-broadcast-email` and `scholars-broadcast-push` in the designated environment and check the existing provider and Supabase bindings. Deploy the Worker with consumption disabled. Confirm the deployment's database schema and that pending jobs stay queued.
3. Record verified allocations in `broadcast_provider_windows`. Use the provider's actual reset boundary, a current credit allowance net of other traffic, and one non-overlapping row per period. Resend needs both a UTC daily window and the agreed monthly window. Retain existing `reserved` counts when refreshing an allocation. Enable `BROADCAST_CONSUMERS_ENABLED` separately only after those checks.

To pause or roll back, disable the consumer flag first. The entry point continues to expose the persisted admin status while Cron stops publishing and queued wakes are ignored. Wait for active lease windows before changing the runtime again. Preserve the additive migration and snapshots so queued jobs can resume. If a pre-repair Worker version must be restored, block the old synchronous admin broadcast POST before routing traffic to it.

### Remaining risks

- Hosted active CPU and production capacity still need the isolated preview check. Workerd verifies compatibility and counted operations. It cannot establish hosted CPU headroom. The 300-recipient test intentionally advances synthetic provider time, so reported elapsed test time is independent of live pacing.
- If a provider accepts a request and the Worker loses both its response or outcome write, it can be classified only as uncertain absent later evidence. The database and logs preserve correlation for separately authorized reconciliation.
- The broadcast quota windows cover the broadcast consumers. Out-of-band account usage can still exhaust a provider sooner than forecast. Pending work stays durable through a queue or provider quota hold. An email lane with an expired allocation waits for a verified replacement.
- The historical Brevo reconciliation remains open. Existing incident records and leases were left intact. The Independence Day send, manual digest, manual profile nudges and deadline push still have the separate single-invocation risks identified in the investigation.

## Qualification

| Check | Result |
| --- | --- |
| `bash scripts/test-broadcast-database.sh` | Passed on isolated PostgreSQL 17. It applied the migration to a Supabase-shaped fixture using the relevant repo migrations. It exercised ACLs, simultaneous submissions, simultaneous quota reservation, 300 email targets, 78 push profiles with 129 devices, deadline-job isolation by kind, quota reset and resumption, expired leases, late accepted outcomes, a failed announcement write and both historical ID exclusions. |
| `node scripts/test-broadcast-worker.mjs` | Passed in workerd through Wrangler and Miniflare. A synthetic 300-email and 78-Web-Push-device campaign completed without a browser under a simulated 50-operation cap. Peak was **7** operations. The harness exercised real Web Push encryption, both native queue events, a provider hold, lost wake recovery, restart, ambiguous provider outcomes, acknowledgement loss and database failures after provider acceptance. |
| `npm test`, `tsc --noEmit`, `npm run build` | Passed on Node 22.20.0. Vitest passed 294 tests across 47 files. The production build used placeholder Supabase values and reported the expected homepage data fallback warnings. |
| OpenNext build, Wrangler dry run and diff validation | Passed with OpenNext 1.20.18 and Wrangler 4.166.0. Dry-run output was 15,740.09 KiB uncompressed and 2,983.48 KiB gzip, with both queue bindings. The hosted deployment sequence remains for a separately authorized rollout. |

All delivery verification used synthetic recipients and mocked network transports. The production investigation was previously read-only. The branch and review PR contain the migration and code for a separately authorized rollout.

## SCHOLARS-003.2.4 deployment qualification

PR #51 remains a draft. This section records local qualification and the operator sequence for a later hosted run. The production migration, queue provisioning, activation and rollout remain gated.

### Codacy review

Reviewed all 11 annotations on the original PR head. The findings below use the line numbers shown in that check. [GitHub Codacy annotations](https://github.com/ImperioKDB/Scholars/pull/51/checks?check_run_id=140792248545)

| File and original line | Disposition |
| --- | --- |
| `BroadcastProgress.tsx:23` | The guard read an unconstrained reason string from a plain object. Inherited names could pass the guard. Replaced the lookup with an explicit switch. |
| `BroadcastProgress.tsx:24` | The second reason lookup could render inherited values. The switch now returns only a supported label or null. React rendered the label as text in both versions. |
| `BroadcastProgress.tsx:50` | False positive. The label was indexed by a static status list. The component now passes an explicit label to each typed row. |
| `BroadcastProgress.tsx:51` | False positive. The email key came from the same static list. The component now reads explicit numeric fields. |
| `BroadcastProgress.tsx:52` | False positive. The push profile key came from the static list. Explicit fields replace it. |
| `BroadcastProgress.tsx:53` | False positive. The push device key came from the static list. Explicit fields replace it. |
| `scripts/test-broadcast-worker.mjs:120` | False positive. The brackets were part of a mock Brevo receipt returned as JSON. Replaced the fixture with a plain opaque ID. |
| `scripts/test-broadcast-worker.mjs:156` | False positive. The script writes a fixed entry filename under its own newly created temporary directory. |
| `scripts/test-broadcast-worker.mjs:177` | False positive. The generated Wrangler config has a fixed filename in that same directory. |
| `scripts/test-broadcast-worker.mjs:183` | False positive. The config directory is a fixed child of the same temporary directory. |
| `scripts/test-broadcast-worker.mjs:188` | False positive. The read uses the fixed output filename produced by Wrangler in the temporary bundle directory. |

The filesystem calls run only in the local qualification harness. Request data cannot select the paths. No analyzer suppressions were added. Confirm the new Codacy run and record any remaining scanner dispositions in the review.

### Evidence

- Live Scholars catalog metadata confirmed that the broadcast migration's referenced tables, types and constraints exist. Production inspection was read-only. A disposable PostgreSQL 17 fixture with those column and key shapes passed the broadcast migration, browser-role grants, 300-recipient and 129-device cases, duplicate submissions, concurrent quota reservations, and quota exhaustion. Deferred campaigns remained open and resumed in the next window. A Web Push subscription recorded with an explicit default port `:443` now passes the database revalidation.
- Applied both additive migrations on fresh databases, in each order. PR #50's deadline claim has an independent runtime error with the live Auth schema. Its return contract declares `email text` while `auth.users.email` supplies `varchar(255)`. In both orders the claim failed with SQLSTATE `42804`. A scratch-only `u.email::text as email` cast made both combined suites pass, including preservation of broadcast projection and historical rows. Have PR #50 take that correction and rerun both orders before a combined rollout. PR #51 no longer edits PR #50's Expo transport file. [PR #50](https://github.com/ImperioKDB/Scholars/pull/50)
- Workerd completed 300 synthetic emails and 78 mock Web Push deliveries with a peak of seven counted operations. It exercised native staging queue routing, a deliberately lost email continuation recovered by Cron, and zero provider network requests from the staging stubs. Disabled staging and production handlers made zero database, provider or queue producer calls for either channel. Admin tests verified enqueue, reload and polling to completion. PostgreSQL verified atomic same-selection deduplication across simultaneous sessions.
- The guarded staging fixtures and allocation SQL ran on a disposable database. They produced a 300-email and 78-device Batch A. Closing an allocation preserved prior reservations, renewal added only the verified remaining amount, and overlapping windows were rejected.
- All 300 Vitest tests across 49 files passed, including the browser polling test. TypeScript, the Next.js production build and OpenNext build passed.
- Wrangler dry runs passed for both configs. Production was 15,742.51 KiB uncompressed and staging was 15,714.72 KiB. Wrangler local startup profiles measured 289.6 ms active in production and 312.0 ms active in staging. These profiles establish local startup headroom. Hosted invocation CPU and startup still require the operator run.

Cloudflare returned one visible Worker, `scholars`, with zero deployed Cron Triggers, and zero configured queues. Analytics reported 917 Worker requests and 2,417 subrequests between 01:00 and about 03:54 WAT on November 28. Queue analytics returned no operation rows from 01:00 through about 03:59 WAT. Subscription data returned HTTP 403 because Billing Read access is missing. The documented Free limits are 100,000 requests per day, 50 subrequests per invocation, 10 ms active CPU for HTTP and Cron, five Cron Triggers, a 64 MiB uncompressed bundle, one second for startup, 10,000 queue operations per day, and 24-hour Free message retention. The inventory leaves five slots under the Free cron cap at the time of inspection. Confirm the actual account plan and remaining daily usage immediately before provisioning. One clean 378-target stage run needs about 1,134 queue operations, plus recovery and diagnostic messages. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Queue pricing](https://developers.cloudflare.com/queues/platform/pricing/)

### Staging sequence for the operator

1. Coordinate use of the empty `scholars-staging` Supabase project, ref `aqhktriwaglvvrchxmtd`, with PR #50. Export or obtain the reviewed Scholars **schema-only** baseline, including roles, grants, and required extensions and the existing Expo token table. Keep all production rows out. Use the staging database URL in `BROADCAST_STAGING_DB_URL` and libpq 17 or newer. The script accepts only this staging project, verifies the TLS certificate, and rejects a populated non-synthetic audience. Run `bash scripts/broadcast-staging-db.sh bootstrap BASELINE.sql`, then `preflight`, `migrate`, and `seed` through the same script. For `seed`, export a 20-character-or-longer `BROADCAST_STAGING_ADMIN_PASSWORD` privately. The fixture creates a confirmed password-login admin and synthetic recipients directly. Use password login and skip mail-based signup or reset.
2. Provision `scholars-broadcast-email-staging` and `scholars-broadcast-push-staging` with `npx wrangler queues create QUEUE_NAME --config wrangler.broadcast-staging.jsonc` for each name. Use the distinct Worker `scholars-broadcast-staging` and protect its workers.dev route with account Access for the operator. Build OpenNext in a clean environment with `NEXT_PUBLIC_SUPABASE_URL` set to `https://aqhktriwaglvvrchxmtd.supabase.co`, the staging legacy anon JWT in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the exact staging Worker origin in `NEXT_PUBLIC_APP_URL`. Verify staging Auth keys and no production environment files before building. Run `npx opennextjs-cloudflare build` and `npx wrangler deploy --config wrangler.broadcast-staging.jsonc --dry-run`. Secret bindings for that config are the staging legacy anon and service-role JWTs plus a newly generated synthetic VAPID pair. Generate the pair privately with `npx --no-install web-push generate-vapid-keys --json`. Put only those four staging keys in a protected JSON file named by `BROADCAST_STAGING_SECRETS_FILE`. Use `npx wrangler deploy --config wrangler.broadcast-staging.jsonc --secrets-file "$BROADCAST_STAGING_SECRETS_FILE" --var BROADCAST_CONSUMERS_ENABLED:false` for the separately authorized staging deploy. It defaults to disabled, recognizes only the two staging queue names, rejects keys carrying another Supabase project ref and blocks the unrelated provider test routes. Stubbed provider responses execute in-process with no network fallback.
3. Initialize a short first synthetic Brevo window with one credit and a second window starting at its exact end with 299 credits. Leave at least three minutes between current time and the first window's end so Cron has time to reproduce deferral. Example command shape is `bash scripts/broadcast-staging-db.sh allocate brevo daily "$START" "$FIRST_END" 1` followed by `bash scripts/broadcast-staging-db.sh allocate brevo daily "$FIRST_END" "$SECOND_END" 299`. Use UTC timestamps with explicit offsets. A stage window can be short because the account is synthetic. Confirm the deployment still has `BROADCAST_CONSUMERS_ENABLED=false`.
4. Sign in at `/login?next=/admin/broadcast` with `broadcast-qualification-admin@broadcast.example.invalid`. Select the ten synthetic listings and submit Batch A. Record the HTTP 202 response, submission UUID and status URL. Resubmit the same JSON and UUID, then submit the same listing selection with a new UUID while the campaign is open. Confirm the same campaign ID in all responses, and verify reload or direct status polling starts with 300 email and 78 push queued. Capture the exact response with no cookies or keys. Confirm the unrelated Brevo, Resend and Independence Day endpoints return 404.
5. With consumption disabled, obtain the two job IDs from `workflow_jobs` by the synthetic campaign ID. Publish one JSON wake per lane using the Cloudflare dashboard queue message tester or its write-message API, to **staging** queues only. On the REST API, POST `{"content_type":"json","body":{"id":"<job UUID>"}}` to `/client/v4/accounts/<account>/queues/<staging queue ID>/messages`. Confirm both events acknowledge with `operations=0` and `stubCalls=0`, no accepted outcomes appear, and the pending job rows remain intact. Wait at least one scheduled tick and verify no Cron-produced dispatch.
6. For the separately authorized staging activation, repeat the exact staging deploy command with `--var BROADCAST_CONSUMERS_ENABLED:true`. Observe the first email acceptance and its `droppedWake=true` event. The next minute's Cron wake should recover work without a browser, and email should become quota deferred after one acceptance while push continues. Before the first window ends, verify an empty completion timestamp. The second window should resume email and end at 300/300 provider accepted email and 78/78 accepted push profiles and devices. Record queue backlog returning to zero and confirm one persisted dispatch per target. Close the browser before completion to verify server ownership. After capture, restore the disabled config.
7. Export the staging Worker invocation logs with active CPU, outcome and UTC timestamp. Correlate them by invocation request ID with `broadcast_qualification_slice` and `broadcast_qualification_cron`. Record p50 and p99 active CPU by event type, peak application and external operations, actual platform subrequest totals, completed targets per channel, elapsed time, number of retries, and time from dropped continuation to the next successful claim. The application count includes the stubbed provider call for budget comparability. `externalOperations` excludes the in-process stub. Compare it to the Cloudflare platform aggregate rather than treating it as platform telemetry.

For the Cloudflare GraphQL measurement, use the validated query shape below and replace the account and UTC run bounds. `cpuTimeP99` in this API is in microseconds. Add `queueMessageOperationsAdaptiveGroups(limit: 1, filter: {datetime_geq: "...", datetime_leq: "..."}) { sum { billableOperations } }` to record account operations for the bounded run. In the per-queue dashboard compare backlog, retries and success for both staging queues.

```graphql
query {
  viewer {
    accounts(filter: {accountTag: "<account>"}) {
      workersInvocationsAdaptive(limit: 10, filter: {
        scriptName: "scholars-broadcast-staging",
        datetime_geq: "<UTC start>", datetime_leq: "<UTC end>"
      }) {
        dimensions { status }
        sum { requests subrequests errors }
        quantiles { cpuTimeP50 cpuTimeP99 }
      }
    }
  }
}
```

Requalify if observed p99 active CPU exceeds 8 ms, startup reaches one second, there are resource-limit outcomes, counted operations exceed 32, or a deferred campaign reports completion. Record hosted values after the operator run. The existing stage project has no Scholars tables and no hosted qualification deployment was performed. [Cloudflare Worker analytics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/) · [Queue metrics](https://developers.cloudflare.com/queues/observability/metrics/)

### Provider allocation and production order

Use [broadcast_allocate.sql](../supabase/operations/broadcast_allocate.sql) through an approved psql session on the intended database. Specify `-v provider=brevo -v period=daily -v starts_at="$START" -v ends_at="$END" -v additional="$SAFE_AVAILABLE"` and pass that file with `-f`. For Resend run the operation once for `daily` and once for `monthly`. Verify Brevo's actual plan, remaining sends, reset time and any queued mail. Use Resend's UTC daily reset and verify the current monthly boundary and usage. Set `SAFE_AVAILABLE` to the lower of verified remaining provider credits and the approved remaining broadcast allocation after reserving capacity for other account traffic. For renewal, add the next non-overlapping window before the previous one ends. A refresh of the same window must use identical boundaries and only capacity remaining from that verification. The SQL serializes against dispatch and preserves `reserved` on refresh. An additional amount of zero closes the current allowance. Non-overlapping future windows permit automatic resumption when due. Check available capacity and deferred counts after every change. A zero or absent allowance is a hold.

Only after separate approval and successful hosted staging qualification, confirm branch and migration order and correct PR #50 before combining its rollout. Provision production queue names from `wrangler.jsonc` and confirm one Cron slot. Apply the reviewed additive broadcast migration via the approved migration runner in one transaction. Deploy the matching Worker with `BROADCAST_CONSUMERS_ENABLED=false`. Smoke-test the authenticated admin and inspect the two queues. Initialize verified allocations, then activate with a separately approved setting change. Preserve the production provider credentials. For rollback, set the flag false first, wait for in-flight attempts and at least one 45-second lease window, and preserve the additive schema and job state. Keep the current paused entry when possible. If reverting to an older Worker, block the old synchronous broadcast POST before routing to it. Do not reset attempts or remove the historical campaign protection.

## Shared staging qualification after merging main

The qualification merge is `22a41ae99d46f5d9fad010858a6b577fe7b7eb49`. Its parents are the
reviewed broadcast head `bf27021d7a35f5fc032f78463e6bee6a22c2f37c` and main
`765d8b750be6642689dfd7adc89060d5eb6872b0`, which includes PR #50 and the
new-match changes from PR #52. The old head passed GitHub CI run 46101019507.
GitHub showed the PR open and in draft with no inline review threads. Codacy
reported 12 high alerts on the previous head. The classifications earlier in
this report are source-review observations. Current-head analyzer results and
independent review are required before release.

### Hosted PostgreSQL evidence

The Session Pooler connected to project `aqhktriwaglvvrchxmtd` on port 5432
with TLS 1.3 and `sslmode=verify-full`. Native PostgreSQL 17 used the
configured private passfile and CA. Every invocation used
`psql -X -w -v ON_ERROR_STOP=1`, a 120-second statement timeout and a
5-second lock timeout. The packet preflight returned `DO` with exit 0.
The final sequential run returned the following sanitized output:

```text
shared_staging_fixture_state.sql exit 0
BEGIN
CREATE FUNCTION
DO
DO
DO
ROLLBACK
deadline_reminders_hosted.sql exit 0
Zero rows across public tables and Auth users/identities; pg_cron job table absent
shared_staging_fixture_state.sql exit 0
Both deadline channels claimed due work without changing any broadcast records
Broadcast scheduling, claim and release preserved active deadline deliveries
ROLLBACK
admin_broadcast_hosted.sql exit 0
Zero rows across public tables and Auth users/identities; pg_cron job table absent
shared_staging_fixture_state.sql exit 0
```

The broadcast suite restored one historical email log row and exactly 599
announcement rows, verified 300 email targets in batch A including an Auth
user without a profile, and observed five deferred targets in batch B.
It asserted 78 push profiles and 129 devices, one accepted attempt per email,
submission deduplication, shared allocation enforcement and resumption,
lease fencing and recovery, uncertain acceptance and late reconciliation,
definitive rejection, and retention of the provider receipt after an injected
announcement write error. Deadline assertions covered Lagos boundaries,
preference and tracking rules, claim isolation and replay, retries, quota and
the 500-row cap. The compatibility scenario exercised both directions with
populated broadcast records and actively leased deadline deliveries.

Initial broadcast attempts exited 3 while adapting the profileless assertion
to the actual target schema, isolating rejection from the original shared
quota window, and accounting for the hosted Auth trigger and broadcast job
selection in compatibility fixtures. Clean-state checks after those runs
exited 0. The final scripts completed with their original exact assertions.
The hosted database was already initialized. Execution used only rollback
transactions. Identity sequences may advance under PostgreSQL rollback rules.

### Application qualification

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | 0 | Lockfile install, Node 22.20.0 |
| `npm test -- lib/broadcast lib/deadlines app/api/admin/broadcast app/api/cron/deadline-check app/admin/broadcast components/admin/BroadcastProgress lib/email/failoverCallers.test.ts lib/push/campaigns.test.ts lib/push/campaigns.integration.test.ts` | 0 | 51 passed and 9 skipped |
| `npm test` | 0 | 350 passed across 54 files, 9 skipped in one file |
| `node_modules/.bin/tsc --noEmit` | 0 | TypeScript passed |
| `node scripts/test-broadcast-worker.mjs` | 0 | Local workerd completed 300 synthetic emails and 78 Web Push targets, injected failure cases, and native queue tests. Peak was 7 counted operations. |
| `npm run build` | 0 | Standalone retry with CI placeholders built all 92 static pages |
| `node_modules/.bin/opennextjs-cloudflare build --config wrangler.broadcast-staging.jsonc` | 0 | Next.js completed its production build and OpenNext emitted the Worker bundle |
| `node_modules/.bin/wrangler deploy --config wrangler.broadcast-staging.jsonc --dry-run` | 0 | 16,306.72 KiB uncompressed, 2,995.71 KiB gzip, 386 assets, both staging queues, consumers disabled |

The first standalone `npm run build` exited 1 at the `/_not-found` page-data invariant while the regression suite was running. The integration suite also runs Next.js in the same checkout. OpenNext and the serial standalone retry both passed after the tests finished.

The first sandboxed focused test command exited 1 because esbuild could
not traverse a parent directory. The focused rerun used the same source and
test config with normal filesystem access. The nine PR #52 new-match
PostgreSQL integration cases require the checked-in Docker harness.
Docker is unavailable in this Windows environment. The hosted SQL evidence
qualifies the deadline and broadcast contracts installed there.

The hosted Worker remains a release gate. Confirm the account plan and
remaining queue operations, provision the distinct staging queues and Worker
under operator approval, and use synthetic provider isolation with staging-only
bindings. Verify the dropped-wake recovery, retry and queue-drain behavior
with platform telemetry. The runbook targets p99 active CPU at or below 8 ms,
startup below one second, at most 32 counted operations per invocation,
and roughly 1,134 queue operations for the 378-target run before retry overhead.
Keep PR #51 in draft pending current-head CI, analyzer review, and independently
approved staging Worker qualification.

See [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/).

## Final Codacy disposition

The operator independently retrieved and reviewed the 14 findings for
`41b1bc361a971b8ba648cdcd9aedd26657fd21d7`. The disposition below records
the reported categories and the corresponding source evidence. The
seven client-syntax annotations were supplied as a group, so their
source references identify the constructs reviewed rather than Codacy
annotation IDs. File and line references are relative to the reviewed head.

| Finding | Source evidence | Disposition |
| --- | --- | --- |
| Compatibility 1 | `supabase/tests/broadcast_staging_fixtures.sql:1`, `\getenv` for the synthetic admin password | False positive. Native psql imports the operator-provided value into a client variable. |
| Compatibility 2 | `supabase/tests/broadcast_staging_fixtures.sql:2`, `\getenv` for the Web Push public key | False positive. Native psql reads the synthetic key from the fixture environment. |
| Compatibility 3 | `supabase/tests/broadcast_staging_fixtures.sql:3`, `\getenv` for the Web Push auth value | False positive. Native psql reads the synthetic auth value from the fixture environment. |
| Compatibility 4 | `supabase/tests/broadcast_staging_fixtures.sql:14`, quoted password substitution | False positive. psql renders a SQL literal for the input to `crypt`. |
| Compatibility 5 | `supabase/tests/broadcast_staging_fixtures.sql:56`, quoted Web Push fixture substitutions | False positive. psql renders SQL literals for the two synthetic subscription values. |
| Compatibility 6 | `supabase/operations/broadcast_allocate.sql:3,8,54`, client error handling and quoted allocation parameters | False positive. psql sets stop-on-error and quotes the operator-supplied values before sending the SQL. |
| Compatibility 7 | `supabase/tests/admin_broadcast_hosted.sql:343`, `\ir` | False positive. Native psql resolves the fixed sibling file and runs it in the hosted suite's rollback transaction. |
| Compatibility 8 | `supabase/tests/admin_broadcast_hosted.sql:361`, closing delimiter for `pg_temp.broadcast_snapshot()` | False positive confirmed. Native PostgreSQL 17 psql created the function and the suite called it before and after the deadline claims. It reported both deadline channels preserved all broadcast records, reached `ROLLBACK`, and exited 0. |
| Security 1 | `scripts/test-broadcast-worker.mjs:156`, entry source write | False positive. `entry.ts` is a fixed child of the harness's freshly created private `mkdtemp` directory. |
| Security 2 | `scripts/test-broadcast-worker.mjs:183`, Wrangler config write | False positive. `wrangler.json` is a fixed child of that directory. |
| Security 3 | `scripts/test-broadcast-worker.mjs:189`, config directory creation | False positive. The harness creates its own fixed `config` subdirectory. |
| Security 4 | `scripts/test-broadcast-worker.mjs:194`, built entry read | False positive. The harness reads the fixed `bundle/entry.js` output of its local Wrangler dry run. |
| Error-prone 1 | `scripts/test-broadcast-worker.mjs:222`, `queueName()` | Corrected. The declaration moved to module scope with its name generation and callers intact. |
| Error-prone 2 | `scripts/test-broadcast-worker.mjs:226`, `stageKey()` | Corrected. The declaration moved to module scope with its synthetic JWT construction and callers intact. |

The operator independently confirmed **Cloudflare Workers Free** through
the billing dashboard. Hosted Worker telemetry and current account usage
remain separate release checks.

After the two declaration moves, `node scripts/test-broadcast-worker.mjs`
exited 0. Local workerd completed the synthetic 300-email and 78-Web-Push
campaign, fault injection, and native queue checks for both runtime modes.
Peak counted operations per simulated event remained 7. `git diff --check`
exited 0.
