#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

container=$(docker run --rm --detach --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine)
trap 'docker stop "$container" >/dev/null' EXIT

db() {
  docker exec -i "$container" psql -qAtX -U postgres -v ON_ERROR_STOP=1 "$@"
}

for _ in {1..40}; do
  if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 -q; then break; fi
  sleep 1
done

db < supabase/tests/deadline_reminders_fixture.sql
db < supabase/tests/new_match_fixture.sql
for migration in \
  0036_add_workflow_outbox_foundation \
  0037_add_notification_delivery_lease \
  0038_add_notification_dead_letter_status \
  0046_add_not_applied_application_status \
  0051_add_atomic_notification_claim \
  0079_enable_push_channel_for_notification_outbox \
  0100_support_opportunity_applications \
  20261127000000_complete_deadline_reminders
do
  db < "supabase/migrations/$migration.sql"
done

# Qualify the generic RPC used by the pre-PR Worker before and after cutover.
db <<'SQL'
insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000001');
insert into public.notification_deliveries
  (id, profile_id, campaign_key, channel, schedule_bucket, dedupe_key, template_version)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
    'new_match', 'push', 'legacy', 'legacy-match', 'legacy'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
    'reengagement', 'email', 'legacy', 'legacy-email', 'legacy');
SQL

claim() {
  db -c "set role service_role; select count(*) from public.claim_notification_delivery(
    '00000000-0000-0000-0000-00000000000$1', now() + interval '10 minutes')"
}

db < supabase/migrations/20261128000000_add_push_campaign_progress.sql
test "$(claim 1)" = 1
db -c "update public.notification_deliveries set status = 'pending', lease_until = null"
db < supabase/migrations/20261128010000_new_match_campaign_engine.sql
test "$(claim 1)" = 0
test "$(claim 2)" = 1
echo 'Legacy generic claim compatibility checks passed'


NEW_MATCH_TEST_CONTAINER="$container" npm test -- lib/push/campaigns.integration.test.ts
