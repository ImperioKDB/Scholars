# Deadline system final qualification

**GO for isolated staging**, with the schema preflight below as the first gate. Production approval depends on hosted throughput and delivery verification.

| Area | Confirmed findings and corrections |
| --- | --- |
| Migration | Reviewed the 142 migration files for the affected schema and consumers. The existing channel and status checks have the expected names. The replacement accepts every legacy value. The outbox already references profiles and scholarships, and the new opportunity FK uses cascade deletion. The existing inbox supports both listing IDs and the `deadline_reminder` enum. Applications have exactly one listing and include `not_applied` as a terminal state. Browser roles retain own-profile preferences and existing inbox RLS. Worker RPCs and internal objects are private. The migration preserves all legacy delivery rows, including pending and leased rows, so applying it first is safe for the previous Worker. |
| Consumers | The existing GitHub deadline workflow is the only repository-declared scheduler. The legacy notification worker is manual and paused. Inngest deadline and nudge handlers skip their events. Reengagement only enrolls fixed campaign keys. Manual digest, profile nudges, admin push and new-match push use their own keys or IDs. The daily new-match campaign keeps its existing scope and default device count. The legacy claim RPC now rejects v2 IDs at the database boundary. Brevo and Resend files and routes are unchanged. |
| Lease | Completion and failure compare delivery ID, leased state and exact lease timestamp. Both stale success and stale retry tests left the newer lease intact. Only push may reclaim an expired v2 lease. Interrupted email becomes `unknown` and remains ineligible for both claim RPCs. |
| Release | V2 uses authenticated POST. The previous Worker returns 405 before it can run the old daily job. An unqualified legacy GET on the new Worker still runs daily new-match and admin maintenance. Both workflow revisions use the same GitHub concurrency group. |

The repository history contains duplicate version prefixes and assumes pre-existing Supabase objects, including `opportunities`, `saved_opportunities` and `push_tokens`. The local upgrade fixture exercises the repository-defined constraints and RPCs against populated rows. The staging schema remains the authority for those baseline objects and their grants.

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

TypeScript and all 297 Vitest tests passed. Disposable PostgreSQL passed populated-outbox upgrade, permission, concurrency, lease, quota and overflow checks. The workflow shell passed mocks for normal runs, unsupported POST on the old Worker, push failure, quota backlog and drain saturation. OpenNext, the Wrangler dry run and the local Worker HTTP check passed.

Qualification changes cover the [migration](../supabase/migrations/20261127000000_complete_deadline_reminders.sql), deadline cron route and tests, deadline engine and tests, the existing GitHub workflow, local SQL fixtures and runner, and these release notes. The original feature's complete file list and Mailtrap setup are in the [implementation report](deadline-notification-repair.md).

Known limits are provider ambiguity for interrupted push, intentionally unretried ambiguous mail, GitHub scheduling delay, and quotas that can leave work unsent. Hosted baseline compatibility, real provider receipt behavior and practical peak capacity remain staging gates. No external sends, deployments or production migrations were performed.
