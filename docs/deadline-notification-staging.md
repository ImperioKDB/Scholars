# Deadline notification staging

Use the existing `fix/deadline-notification-system` branch. The staging Worker is `scholars-deadline-staging`. Its [Wrangler configuration](../wrangler.staging.jsonc) disables deadline email, has no Cron Trigger or custom route, and requires only the staging Supabase service key and cron bearer secret. The production `wrangler.jsonc`, including `keep_vars: true`, and the production workflow stay untouched by this procedure.

## 1. Identify the isolated targets

- In the Supabase dashboard, select a separate staging project or persistent staging branch with the expected Scholars **schema only**. The preflight requires empty auth-user, profile and device tables. Disable public sign-ups in the staging Auth settings before opening the Worker URL. Copy its 20-character project ref from **Project Settings → General**. The known production ref `cmdglabohpttgfofcmqc` is rejected by the wrapper.
- In the Cloudflare dashboard, select the staging account and create or identify `scholars-deadline-staging`. Confirm its Workers.dev hostname is `scholars-deadline-staging.<account-subdomain>.workers.dev`. Record that account ID and hostname. Keep the Worker free of Mailtrap, Brevo, Resend, Expo and VAPID settings or bindings.
- Put all credentials in a private local shell or the appropriate platform secret store. Keep the production Actions variables and secrets out of this shell and leave the production scheduler alone.

## 2. Preflight and apply

In the operator shell, set `SCHOLARS_STAGING_PROJECT_REF` to the verified staging ref. From the staging Supabase dashboard, obtain the direct database connection parameters and TLS root certificate. Set `SCHOLARS_STAGING_DB_CA` to the absolute certificate path. Create a mode-0600 passfile outside the repository and set `SCHOLARS_STAGING_PGPASSFILE` to its absolute path. The passfile entry must match `db.<staging-ref>.supabase.co:5432:postgres:postgres:<staging-db-password>`. Use a client with `psql` and direct network access to the staging database.

```bash
bash scripts/deadline-staging-db.sh preflight
bash scripts/deadline-staging-db.sh apply
```

Run `apply` only after preflight returns zero generated intents and rolls back successfully. The wrapper builds the host from the ref, requires full TLS verification, and reruns the preflight before committing the single migration. If the version or RPC already exists, inspect the staging migration history before proceeding. Record the completed migration as `20261127000000` in the staging deployment record. For a project managed through a migration ledger, have the staging database administrator reconcile that version in the staging ledger. The legacy migration history assumes a baseline and contains duplicate version prefixes.

## 3. Deploy only the staging Worker

In Cloudflare, open the verified staging Worker and use **Settings → Variables and Secrets** to add `SUPABASE_SERVICE_ROLE_KEY` from the staging Supabase project and a fresh `CRON_SECRET` as encrypted secrets. Use a Cloudflare API token scoped to deploying Workers in the staging account and set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` securely in the local shell. Set `SCHOLARS_STAGING_SUPABASE_ANON_KEY` to the staging project's public key and `SCHOLARS_STAGING_WORKER_URL` to its verified HTTPS Workers.dev origin.

From the repository root, use Node 22.20.0 and the installed lockfile tools. Keep `.env`, `.env.local`, `.env.production`, and `.env.production.local` out of this staging checkout during the build so Next.js cannot load other bindings.

```bash
set -euo pipefail
[[ "$SCHOLARS_STAGING_PROJECT_REF" =~ ^[a-z0-9]{20}$ &&
   "$SCHOLARS_STAGING_PROJECT_REF" != cmdglabohpttgfofcmqc ]]
[[ "$SCHOLARS_STAGING_WORKER_URL" =~ ^https://scholars-deadline-staging\.[a-z0-9-]+\.workers\.dev$ ]]
for file in .env .env.local .env.production .env.production.local; do test ! -e "$file"; done

export NEXT_PUBLIC_SUPABASE_URL="https://$SCHOLARS_STAGING_PROJECT_REF.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${SCHOLARS_STAGING_SUPABASE_ANON_KEY:?Set the staging public key}"
export NEXT_PUBLIC_APP_URL="$SCHOLARS_STAGING_WORKER_URL"
export NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=""
export CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false

./node_modules/.bin/opennextjs-cloudflare build --config wrangler.staging.jsonc
./node_modules/.bin/wrangler deploy --config wrangler.staging.jsonc --dry-run \
  --var "NEXT_PUBLIC_SUPABASE_URL:$NEXT_PUBLIC_SUPABASE_URL" \
  --var "NEXT_PUBLIC_SUPABASE_ANON_KEY:$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --var "NEXT_PUBLIC_APP_URL:$NEXT_PUBLIC_APP_URL"
```

Verify the staging URL in your shell and the public binding names and both false email bindings in the dry-run output. Confirm the account ID, Worker name and encrypted secrets in the Cloudflare dashboard. Then repeat the same Wrangler command without `--dry-run` to deploy to staging.

## 4. Verify with synthetic data

Use the staging bearer secret supplied securely to the shell as `SCHOLARS_STAGING_CRON_SECRET`. Run each sequence inside one Lagos reminder window, away from noon and midnight. The fixtures set every test profile to in-app only and use reserved `example.invalid` addresses.

```bash
deadline_call() {
  printf 'Authorization: Bearer %s\n' "${SCHOLARS_STAGING_CRON_SECRET:?Set the staging secret}" |
    curl --request POST --proto '=https' --header @- --max-time 75 --fail-with-body \
      --silent --show-error --write-out '%{stderr}wall=%{time_total}s\n' \
      "$SCHOLARS_STAGING_WORKER_URL/api/cron/deadline-check?task=$1"
}

curl --request POST --proto '=https' --max-time 15 --silent --show-error \
  --output /dev/null --write-out '%{http_code}\n' \
  "$SCHOLARS_STAGING_WORKER_URL/api/cron/deadline-check?task=prepare" # 401

bash scripts/deadline-staging-db.sh seed-functional
deadline_call prepare | jq -e '.emailEnabled == false and .inboxDelivered == 2'
deadline_call prepare | jq -e '.inboxDelivered == 0 and .generated == 0'
deadline_call push | jq -e '.processed == 0'
deadline_call email | jq -e '.processed == 0'
deadline_call backlog | jq -e '.inApp == 0 and .push == 0 and .email == 0'
bash scripts/deadline-staging-db.sh cleanup

bash scripts/deadline-staging-db.sh seed-load
deadline_call prepare | jq -e '.capacityReached == true and .inboxDelivered == 500'
deadline_call prepare | jq -e '.capacityReached == false and .inboxDelivered == 1'
deadline_call prepare | jq -e '.generated == 0 and .inboxDelivered == 0'
bash scripts/deadline-staging-db.sh cleanup
```

Check the Cloudflare invocation wall time, CPU and subrequests for the 501-profile sequence and confirm the logs contain no provider sends. These checks measure hosted inbox discovery and overflow. External push and email delivery throughput stays outside this staging pass. Leave scheduling unconfigured during manual testing. If an Actions run is needed, use a separate staging repository and set its own `APP_URL` and `CRON_SECRET`.

## Pull request notes

The staging additions are the separate Wrangler config, guarded database wrapper, rollback preflight, synthetic SQL fixtures, and this runbook. The staging-configured OpenNext build and Wrangler dry run passed. Disposable PostgreSQL verified rollback, apply, the two-recipient check, the 500-plus-one load sequence, and cleanup. The staging configuration also ran in a local Worker and confirmed that email and receipt tasks did no work. The prior [qualification report](deadline-notification-qualification.md) covers the feature patch. A hosted qualification requires verified staging targets and platform credentials.
