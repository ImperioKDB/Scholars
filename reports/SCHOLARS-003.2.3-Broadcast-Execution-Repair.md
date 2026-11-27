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
