#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="scholars-broadcast-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --rm --name "$container" -e POSTGRES_PASSWORD=synthetic-test postgres:17-alpine >/dev/null
for _ in $(seq 1 40); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.5
done
sql() { docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }
for file in supabase/tests/admin_broadcast_fixture.sql supabase/migrations/{0015_add_announcement_log,0023_add_broadcast_delivery_log,0036_add_workflow_outbox_foundation,0037_add_notification_delivery_lease,0038_add_notification_dead_letter_status,0078_add_web_push_subscriptions,0079_enable_push_channel_for_notification_outbox}.sql \
  supabase/migrations/*_durable_admin_broadcast.sql supabase/tests/admin_broadcast.test.sql; do
  sql < "$file"
done

# Two independent database sessions race on a fresh A-batch selection.
first="e0000000-0000-4000-8000-000000000010"
second="e0000000-0000-4000-8000-000000000011"
submit() {
  sql -Atq -c "set role service_role; select public.broadcast_enqueue('$1','$2',
    array['b0000000-0000-4000-8000-000000000003'::uuid],'{}','A','https://example.invalid')->>'id';"
}
one=$(mktemp)
two=$(mktemp)
trap 'rm -f "$one" "$two"; docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
submit "a0000000-0000-4000-8000-000000000001" "$first" > "$one" &
first_pid=$!
submit "a0000000-0000-4000-8000-000000000002" "$second" > "$two" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
test -s "$one"
cmp "$one" "$two"
test "$(sql -Atq -c "select count(*) from public.broadcast_submissions where id in ('$first','$second');")" = 2
printf '%s\n' 'Isolated PostgreSQL checks and simultaneous submissions passed.'

# Claim two distinct campaigns simultaneously against one remaining email.
race_campaign=$(cat "$one")
sql -q -c "update public.broadcast_provider_windows set allowance = reserved + 1
  where provider = 'resend' and starts_at < now() and ends_at > now();
  update public.broadcast_provider_state set next_at = now() - interval '1 second' where provider_key = 'resend';"
reserve() {
  sql -Atq -c "set role service_role;
    select public.broadcast_begin(j.id,(c.claim->>'token')::uuid,(c.claim#>>'{target,id}')::bigint,'resend',null) is not null
    from public.workflow_jobs j
    cross join lateral (select public.broadcast_claim(j.id,'email') claim) c
    where j.correlation_id = '$1' and j.kind = 'broadcast_email';"
}
reserve "$race_campaign" > "$one" &
first_pid=$!
reserve "e0000000-0000-4000-8000-000000000004" > "$two" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
test "$(sort "$one" "$two" | tr -d '\n')" = "ft"
printf '%s\n' 'Concurrent campaigns shared the single remaining provider allocation.'
