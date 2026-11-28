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
  20261127000000_complete_deadline_reminders \
  20261128000000_add_push_campaign_progress \
  20261128010000_new_match_campaign_engine
do
  db < "supabase/migrations/$migration.sql"
done

NEW_MATCH_TEST_CONTAINER="$container" npm test -- lib/push/campaigns.integration.test.ts
