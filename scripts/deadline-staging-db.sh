#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

operation=${1:-preflight}
case "$operation" in
  preflight|apply|seed-functional|seed-load|cleanup) ;;
  *) echo 'Usage: bash scripts/deadline-staging-db.sh {preflight|apply|seed-functional|seed-load|cleanup}' >&2; exit 2 ;;
esac

ref=${SCHOLARS_STAGING_PROJECT_REF:-}
if [[ ! "$ref" =~ ^[a-z0-9]{20}$ || "$ref" == cmdglabohpttgfofcmqc ]]; then
  echo 'Set SCHOLARS_STAGING_PROJECT_REF to the verified isolated Supabase project ref.' >&2
  exit 2
fi

: "${SCHOLARS_STAGING_DB_CA:?Use the staging Supabase database CA file.}"
: "${SCHOLARS_STAGING_PGPASSFILE:?Use a private, staging-only PostgreSQL passfile.}"
test -r "$SCHOLARS_STAGING_DB_CA" && test -r "$SCHOLARS_STAGING_PGPASSFILE"
command -v psql >/dev/null

host="db.$ref.supabase.co"
echo "Target: $host:5432 (TLS verify-full). Operation: $operation."

db() {
  env -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPASSWORD -u PGOPTIONS     PGPASSFILE="$SCHOLARS_STAGING_PGPASSFILE" PGSSLROOTCERT="$SCHOLARS_STAGING_DB_CA"     PGSSLMODE=verify-full PGGSSENCMODE=disable PGCONNECT_TIMEOUT=10     psql -X -w -v ON_ERROR_STOP=1 -h "$host" -p 5432 -U postgres -d postgres "$@"
}

preflight() {
  db -v apply=false -f supabase/tests/deadline_staging_preflight.sql
}

case "$operation" in
  preflight) preflight ;;
  apply)
    preflight
    db -v apply=true -f supabase/tests/deadline_staging_preflight.sql
    ;;
  seed-functional)
    db -v cleanup=false -v fixture_count=3 -f supabase/tests/deadline_staging_fixtures.sql
    ;;
  seed-load)
    db -v cleanup=false -v fixture_count=501 -f supabase/tests/deadline_staging_fixtures.sql
    ;;
  cleanup)
    db -v cleanup=true -f supabase/tests/deadline_staging_fixtures.sql
    ;;
esac
