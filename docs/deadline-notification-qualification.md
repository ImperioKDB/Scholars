# Deadline system final qualification

**GO for isolated staging**, with the schema preflight below as the first gate. Production approval depends on hosted throughput and delivery verification.

| Area | Confirmed findings and corrections |
| --- | --- |
| Migration | Reviewed the 142 migration files for the affected schema and consumers. The existing channel and status checks have the expected names. The replacement accepts every legacy value. The outbox already references profiles and scholarships, and the new opportunity FK uses cascade deletion. The existing inbox supports both listing IDs and the `deadline_reminder` enum. Applications have exactly one listing and include `not_applied` as a terminal state. Browser roles retain own-profile preferences and existing inbox RLS. Worker RPCs and internal objects are private. The migration preserves all legacy delivery rows, including pending and leased rows, so applying it first is safe for the previous Worker. The deadline claim explicitly converts the Supabase auth email from `varchar(255)` to its declared `text` result type. |
| Consumers | The existing GitHub deadline workflow is the only repository-declared scheduler. The legacy notification worker is manual and paused. Inngest deadline and nudge handlers skip their events. Reengagement only enrolls fixed campaign keys. Manual digest, profile nudges, admin push and new-match push use their own keys or IDs. The daily new-match campaign keeps its existing scope and default device count. The legacy claim RPC now rejects v2 IDs at the database boundary. Brevo and Resend files and routes are unchanged. |
| Lease | Completion and failure compare delivery ID, leased state and exact lease timestamp. Both stale success and stale retry tests left the newer lease intact. Only push may reclaim an expired v2 lease. Interrupted email becomes `unknown` and remains ineligible for both claim RPCs. |
| Release | V2 uses authenticated POST. The previous Worker returns 405 before it can run the old daily job. An unqualified legacy GET on the new Worker still runs daily new-match and admin maintenance. Both workflow revisions use the same GitHub concurrency group. |

The repository history contains duplicate version prefixes and assumes pre-existing Supabase objects, including `opportunities`, `saved_opportunities` and `push_tokens`. The local upgrade fixture exercises the repository-defined constraints and RPCs against populated rows. The staging schema remains the authority for those baseline objects and their grants.

## PR #51 migration compatibility

Read-only production schema metadata confirmed `auth.users.email` is `varchar(255)`. The production-faithful PostgreSQL fixture reproduced SQLSTATE `42804` on the previous migration at return column 10. The corrected claim returns the confirmed address on email claims and a typed null on push claims. The other 11 result columns match their sources. The four IDs are `uuid`, both listing titles and the profile name are `text`, and application status is already cast from its enum to `text`. Deadline date is `date`, deadline stage is `text`, attempt count is `integer` and the lease expiry is `timestamptz`.

The deadline SQL suite passed on disposable PostgreSQL 16. Both orders passed on disposable PostgreSQL 17 with the broadcast migration and database suite from PR #51 pinned to `bf27021d7a35f5fc032f78463e6bee6a22c2f37c`. The combined checks ran deadline preparation and claimed due email and push work as `service_role`. Full row snapshots matched before and after for the historical fixtures representing both broadcasts, the broadcast outbox, campaigns, submissions, targets, workflow jobs and provider state and allocation windows. The pinned suite also passed the simultaneous submission and shared provider quota races.

Run the combined checks from the root of the deadline checkout. The appended SQL extends the pinned suite in a disposable checkout.

```sh
(
  set -e
  deadline_root=$(pwd)
  scratch=$(mktemp -d)
  git worktree add --detach "$scratch/pr51" bf27021d7a35f5fc032f78463e6bee6a22c2f37c
  trap 'git worktree remove --force "$scratch/pr51" && rmdir "$scratch"' EXIT
  cat supabase/tests/deadline_broadcast_compat.sql >> "$scratch/pr51/supabase/tests/admin_broadcast_deadline_compat.sql"
  for order in deadline-first broadcast-first; do
    bash "$scratch/pr51/scripts/test-broadcast-database.sh" \
      "$deadline_root/supabase/migrations/20261127000000_complete_deadline_reminders.sql" "$order"
  done
)
```

## Codacy review

Reviewed all 17 annotations on the original PR #50 head. The receipt URL annotation identified a validation gap at the helper boundary. The original caller already validated its configured account ID and the request used a fixed HTTPS origin with redirects disabled. The helper now also requires a numeric account ID before issuing a request. Mocked receipt tests cover invalid segments, the authorized endpoint and redirect handling. The remaining 16 annotations are false positives. [PR #50 Codacy check](https://github.com/ImperioKDB/Scholars/pull/50/checks?check_run_id=140785769981)

| Original file and line | Disposition |
| --- | --- |
| `components/DeadlineNotificationSettings.tsx:17` | The property read for dirty state uses only the three keys defined in the local constant. |
| `components/DeadlineNotificationSettings.tsx:46` | The checkbox update uses the same fixed keys. The event supplies only the boolean value. |
| `lib/deadlines/mailtrapReceipts.ts:11` | The origin was fixed. Added account ID validation inside the request helper so both path segments are validated at the call boundary. |
| `supabase/tests/deadline_staging_fixtures.sql:23` | `\if :cleanup` is a `psql` conditional. |
| `supabase/tests/deadline_staging_fixtures.sql:30` | `\else` is part of the `psql` conditional. |
| `supabase/tests/deadline_staging_fixtures.sql:36` | The reseed guard is a valid PL/pgSQL `end if` inside a `DO` block. |
| `supabase/tests/deadline_staging_fixtures.sql:38` | The `DO` block's dollar quote is closed correctly. |
| `supabase/tests/deadline_staging_fixtures.sql:46` | `psql` substitutes the wrapper's integer `fixture_count` in `generate_series`. |
| `supabase/tests/deadline_staging_fixtures.sql:61` | The wrapper's `psql` variable selects the functional or load saved-list branch. |
| `supabase/tests/deadline_staging_fixtures.sql:66` | The same substitution limits application inserts to the functional branch. |
| `supabase/tests/deadline_staging_fixtures.sql:67` | `\endif` closes the `psql` conditional. |
| `supabase/tests/deadline_staging_preflight.sql:33` | `\ir` includes the migration relative to the `psql` script's directory. |
| `supabase/tests/deadline_staging_preflight.sql:47` | The privilege guard is a valid PL/pgSQL `end if` inside a `DO` block. |
| `supabase/tests/deadline_staging_preflight.sql:49` | The privilege guard's dollar quote is closed correctly. |
| `supabase/tests/deadline_staging_preflight.sql:55` | `\if :apply` is a `psql` conditional. |
| `supabase/tests/deadline_staging_preflight.sql:60` | `\else` selects the preflight rollback. |
| `supabase/tests/deadline_staging_preflight.sql:62` | `\endif` closes the `psql` conditional. |

Executed both preflight branches and the functional (3 profiles) and load (501 profiles) seed and cleanup branches through `psql` against disposable PostgreSQL. This verified the flagged client syntax, rollback on preflight, scheduler marker removal on apply and fixture cleanup.

## Hourly capacity

| Work | Upper bound per hourly run |
| --- | --- |
| Discovery and inbox | 500 new intents per channel, up to 1,500 across channels. Up to 500 inbox writes. |
| Push | 16 requests × 3 bundles = 48 recipient bundles and at most 576 listing intents. Each bundle can reach five browser subscriptions and five Expo tokens. |
| Mailtrap | 12 requests × 10 bundles = 120 recipient bundles, capped further by remaining daily and monthly quota. Defaults are 140/day and 3,800/month UTC. Up to 12 listings share a bundle. |
| Mailtrap logs | Eight distinct accepted messages per run when log access is enabled. |

Push caps application-issued external calls at 39 per Worker request, allowing for claims, device reads, sends, pruning and two outcome writes per bundle. The equivalent upper bounds are 40 for mail and 17 for receipts. Cloudflare Free allows 50 external subrequests per invocation and has separate CPU and connection limits. The daily new-match task retains its original behavior and needs its own hosted timing measurement. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

GitHub allows 20 minutes. Each drain lane stops starting requests after 12 minutes, with a 75-second cap per v2 request. The lanes run in parallel. Maintenance runs independently with its original 300-second allowance. Discovery saturation, a drain hitting either limit, and remaining urgent queued work all fail the workflow visibly. The last check also reports current email quota exhaustion. These are ceilings. Retries, provider errors, queueing, quota and the end of a reminder window reduce achievable throughput.

## Exact staging sequence and checks

The [isolated staging runbook](deadline-notification-staging.md) provides the guarded commands and separate Worker configuration.

1. Use an isolated staging database with synthetic profiles and no real push tokens, browser subscriptions or provider credentials. Keep the workflow disabled and set `DEADLINE_EMAIL_ENABLED=false`. Verify the database URL and Worker hostname belong to staging. Keep the previous Worker revision and workflow definition available for rollback.
2. From the repository root, run this transactional preflight against staging. The migration should load, and both RPC calls should return JSON. Check the copied schema's legacy constraints, service-role table access, own-profile and notifications RLS, and auth email columns against the deployed schema. Require `can_record_outcomes=t`. The historical files depend on a baseline and duplicate some version prefixes. If the earlier draft migration is already recorded in staging, stop and prepare a forward migration for that schema.

   ```sh
   psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
   begin;
   \i supabase/migrations/20261127000000_complete_deadline_reminders.sql
   select email, email_confirmed_at from auth.users limit 0;
   select has_table_privilege('service_role', 'public.notification_deliveries', 'SELECT')
     and has_table_privilege('service_role', 'public.notification_deliveries', 'UPDATE') as can_record_outcomes;
   set local role service_role;
   select public.prepare_deadline_reminders(7, 3, false, false);
   select public.deadline_reminder_backlog(7, 3, false);
   rollback;
   SQL
   ```

3. Apply just `20261127000000_complete_deadline_reminders.sql` in one transaction through the staging migration process and record that version. Deploy the matching Worker to the staging hostname after the migration. Leave the scheduler disabled during the route checks.
4. Verify unauthorized POST returns 401, authenticated POST with an invalid task returns 400, and authenticated unqualified GET returns the daily maintenance response. In Lagos local time, seed today's verified deadline, a saved fake profile, an in-progress fake application and one terminal `not_applied` or `submitted` profile. POST to `/api/cron/deadline-check?task=prepare` with the staging `CRON_SECRET`. Check the expected inbox entries, then repeat and require zero new intents. Confirm browser roles cannot invoke the worker RPCs or see another student's data.
5. Exercise v2 claims, old-claim rejection, expired email, VAPID/Expo and Mailtrap results using `bash scripts/test-deadline-reminders.sh` and the mocked Vitest providers. For representative hosted load, measure the staging Worker with the expected number of synthetic saved and tracked rows. Verify the backlog check and alert path at 501 urgent recipients and measure database latency and Worker CPU/subrequests against the thresholds above. Keep outbound providers stubbed or disabled.
6. Point the isolated staging workflow's `APP_URL` and `CRON_SECRET` at that Worker. Run the staged workflow once manually and confirm the prepare, push, email, receipts, backlog and maintenance responses. Then enable only this workflow and observe one hourly run at minute 17 WAT and one daily maintenance run at 09:17 WAT. Use a separate staging repository or workflow configuration. The shared production `APP_URL` affects other jobs.

For rollback, disable the workflow, wait for in-flight jobs, and set `DEADLINE_EMAIL_ENABLED=false`. Leave the additive migration and delivery ledger in place. Restore the previous Worker if necessary. Keep the deadline workflow paused after a full Worker rollback until an operator reconciles potential duplicate v1/v2 notices and explicitly elects to resume the old GET workflow. The old Worker cannot claim v2 rows.

## Worker configuration

- **Build variables** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` for browser push.
- **Existing secrets** `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and `WEB_PUSH_VAPID_PRIVATE_KEY` for browser push. Retain `UPSTASH_REDIS_REST_TOKEN`, `BREVO_API_KEY` and `RESEND_API_KEY` as required by the existing Wrangler config. Retain the app's existing Redis URL and sender config.
- **Deadline variables** `DEADLINE_EMAIL_ENABLED=false`, `DEADLINE_PASSED_EMAIL_ENABLED=false`, `DEADLINE_REMINDER_DAYS=7`, `DEADLINE_PUSH_REMINDER_DAYS=3`, `DEADLINE_EMAIL_DAILY_LIMIT=140`, `DEADLINE_EMAIL_MONTHLY_LIMIT=3800`. `WEB_PUSH_SUBJECT` is optional.
- **When email is enabled** Set the `MAILTRAP_API_TOKEN` secret and `DEADLINE_FROM_EMAIL` on the verified sender domain. `DEADLINE_FROM_NAME` defaults to Scholars. Optional confirmation uses `MAILTRAP_ACCOUNT_ID` and the `MAILTRAP_LOG_API_TOKEN` secret.
- **GitHub Actions** `APP_URL` is the canonical HTTPS origin, and its `CRON_SECRET` must match the Worker secret.

## Validation, changes and limitations

The compatibility correction passed all 299 Vitest tests, `tsc --noEmit`, the Next.js production build and diff validation. The build used placeholder Supabase settings and exercised the homepage's static fallback. Disposable PostgreSQL passed populated-outbox upgrade, permission, concurrency, lease, quota and overflow checks, plus the two migration orders above. The preceding qualification also passed workflow shell mocks for normal runs, unsupported POST on the old Worker, push failure, quota backlog and drain saturation, along with OpenNext, the Wrangler dry run and the local Worker HTTP check.

Qualification changes cover the [migration](../supabase/migrations/20261127000000_complete_deadline_reminders.sql), deadline cron route and tests, deadline engine and tests, the existing GitHub workflow, local SQL fixtures and runner, and these release notes. The original feature's complete file list and Mailtrap setup are in the [implementation report](deadline-notification-repair.md).

Known limits are provider ambiguity for interrupted push, intentionally unretried ambiguous mail, GitHub scheduling delay, and quotas that can leave work unsent. Hosted baseline compatibility, real provider receipt behavior and practical peak capacity remain staging gates. No external sends, deployments or production migrations were performed.
