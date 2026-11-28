#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
container=$(docker run --rm --detach --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine)
trap 'docker stop "$container" >/dev/null' EXIT

db() {
  docker exec -i "$container" psql -qAtX -U postgres -v ON_ERROR_STOP=1 "$@"
}

for _ in {1..40}; do
  if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 -q; then
    break
  fi
  sleep 1
done

db < supabase/tests/deadline_reminders_fixture.sql
for migration in \
  0036_add_workflow_outbox_foundation \
  0037_add_notification_delivery_lease \
  0038_add_notification_dead_letter_status \
  0046_add_not_applied_application_status \
  0051_add_atomic_notification_claim \
  0079_enable_push_channel_for_notification_outbox \
  0100_support_opportunity_applications
do
  db < "supabase/migrations/$migration.sql"
done
# Upgrade populated legacy rows, then compare every pre-existing column.
db <<'SQL'
insert into public.profiles (id) values ('00000000-0000-4000-8000-000000000099');
insert into public.notification_deliveries
  (profile_id, campaign_key, channel, schedule_bucket, dedupe_key, template_version, status)
select '00000000-0000-4000-8000-000000000099', campaign, channel, 'legacy', campaign || channel || status, 'v1', status
from (values ('deadline_reminder'), ('new_match'), ('digest'), ('reengagement')) campaigns(campaign)
cross join (values ('email'), ('push'), ('whatsapp')) channels(channel)
cross join (values ('pending'), ('leased'), ('accepted'), ('delivered'), ('bounced'), ('suppressed'),
  ('failed'), ('retryable'), ('dead_letter')) states(status);
grant select, update on public.notification_deliveries to service_role;
create table legacy_snapshot as select id, to_jsonb(d) as fields from public.notification_deliveries d;
SQL
db < supabase/migrations/20261127000000_complete_deadline_reminders.sql
test "$(db -c "select count(*) from legacy_snapshot s full join public.notification_deliveries d using (id)
  where s.fields is distinct from to_jsonb(d) - array['deadline_date','deadline_stage','opportunity_id']")" = 0
test "$(db -c "set role service_role; select count(*) from public.claim_notification_delivery(
  (select id from public.notification_deliveries where dedupe_key = 'new_matchpushpending'), now() + interval '10 minutes')")" = 1
# Remove the isolated compatibility fixtures before the delivery scenarios.
db -c 'drop table legacy_snapshot; delete from public.profiles;'
db < supabase/tests/deadline_reminders.sql

# Concurrent calls have distinct database sessions and compete for the same
# inbox work, push intent and last available email reservation.
db <<'SQL'
insert into public.profiles (id, deadline_email_enabled) values
  ('00000000-0000-4000-8000-000000000001', true), ('00000000-0000-4000-8000-000000000002', true);
insert into auth.users (id, email, email_confirmed_at)
select id, id || '@example.test', now() from public.profiles;
insert into public.scholarships (id, title, deadline, verified) values
  ('00000000-0000-4000-8000-000000000003', 'Early', (now() at time zone 'Africa/Lagos')::date + 7, true),
  ('00000000-0000-4000-8000-000000000004', 'Late', (now() at time zone 'Africa/Lagos')::date + 3, true);
insert into public.saved_scholarships
select id, '00000000-0000-4000-8000-000000000003'::uuid from public.profiles
union all select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004';
insert into public.web_push_subscriptions values ('00000000-0000-4000-8000-000000000001', true);
SQL

race() {
  local statement="$1" first second
  db -c "begin; set local role service_role; $statement; select pg_sleep(1); commit;" >/dev/null &
  first=$!
  db -c "set role service_role; $statement;" >/dev/null &
  second=$!
  wait "$first"
  wait "$second"
}

race 'select public.prepare_deadline_reminders(7, 3, true, false)'
test "$(db -c 'select count(*) from public.notifications')" = 3
race "select id from public.claim_deadline_reminders('push', 7, 3, false, 0, 0)"
test "$(db -c "select count(*) from public.notification_deliveries where channel = 'push' and attempts = 1")" = 1
race "select id from public.claim_deadline_reminders('email', 7, 3, false, 1, 1)"
test "$(db -c 'select count(*) from public.deadline_email_attempts')" = 1
test "$(db -c "select count(*) from public.notification_deliveries where channel = 'email' and status = 'leased'")" = 1
echo 'Deadline SQL and concurrent delivery checks passed'
