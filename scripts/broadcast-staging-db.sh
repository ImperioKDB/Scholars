#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Validate without placing the credential in a command argument.
node --input-type=module <<'JS'
const ref = 'aqhktriwaglvvrchxmtd';
const value = process.env.BROADCAST_STAGING_DB_URL;
if (!value) throw new Error('Set BROADCAST_STAGING_DB_URL');
const url = new URL(value);
const direct = url.hostname === 'db.' + ref + '.supabase.co' && url.username === 'postgres';
const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && url.username === 'postgres.' + ref;
if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!direct && !pooler)
  || !['', '5432'].includes(url.port) || url.pathname !== '/postgres' || url.search || url.hash || !url.password) {
  throw new Error('Expected the exact broadcast staging DB project and session connection');
}
JS
export PGDATABASE="$BROADCAST_STAGING_DB_URL"
export PGSSLMODE=verify-full
export PGSSLROOTCERT=system
db() { psql -X -v ON_ERROR_STOP=1 "$@"; }

case "${1:-}" in
  preflight)
    db -f supabase/tests/broadcast_staging_preflight.sql
    ;;
  bootstrap)
    : "${2:?Provide the reviewed schema-only baseline SQL file}"
    db --single-transaction -f "$2" -f supabase/tests/broadcast_staging_preflight.sql
    ;;
  migrate)
    db --single-transaction -f supabase/tests/broadcast_staging_preflight.sql \
      -f supabase/migrations/20261127233336_durable_admin_broadcast.sql
    ;;
  seed)
    : "${BROADCAST_STAGING_ADMIN_PASSWORD:?Set a password for the synthetic staging admin}"
    if [[ ${#BROADCAST_STAGING_ADMIN_PASSWORD} -lt 20 ]]; then
      printf '%s\n' 'Use a staging admin password of at least 20 characters.' >&2
      exit 1
    fi
    read -r BROADCAST_STAGING_SUBSCRIPTION_KEY BROADCAST_STAGING_SUBSCRIPTION_AUTH < <(
      node -e "const {createECDH,randomBytes}=require('node:crypto');const k=createECDH('prime256v1');k.generateKeys();console.log(k.getPublicKey().toString('base64url'), randomBytes(16).toString('base64url'))"
    )
    export BROADCAST_STAGING_SUBSCRIPTION_KEY BROADCAST_STAGING_SUBSCRIPTION_AUTH
    db --single-transaction -f supabase/tests/broadcast_staging_preflight.sql \
      -f supabase/tests/broadcast_staging_fixtures.sql
    ;;
  allocate)
    shift
    if [[ $# -ne 5 ]]; then
      printf '%s\n' 'Usage: bash scripts/broadcast-staging-db.sh allocate PROVIDER PERIOD START END ADDITIONAL' >&2
      exit 2
    fi
    db -v "provider=$1" -v "period=$2" -v "starts_at=$3" -v "ends_at=$4" -v "additional=$5" \
      -f supabase/operations/broadcast_allocate.sql
    ;;
  *)
    printf '%s\n' 'Usage: bash scripts/broadcast-staging-db.sh bootstrap FILE|preflight|migrate|seed|allocate' >&2
    exit 2
    ;;
esac
