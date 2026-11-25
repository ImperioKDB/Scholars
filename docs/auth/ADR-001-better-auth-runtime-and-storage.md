# ADR-001: Better Auth runtime and storage for Scholars

**Status:** Investigation in progress — no production decision approved
**Branch:** `auth/better-auth-staging`
**Date:** 2026-11-25

## Context

Scholars currently runs Next.js 15.5.29 through OpenNext on Cloudflare Workers. Authentication uses Supabase Auth and `@supabase/ssr`. User identity is coupled to the existing PostgreSQL schema and row-level security policies.

The connected staging Supabase project is active but currently has no public tables. The connected Cloudflare account currently has no Hyperdrive configurations.

## Verified runtime constraints

- The repository's Wrangler configuration already enables `nodejs_compat`.
- Better Auth's current Cloudflare guide says a module-scope auth instance must not retain a persistent database client/connection pool, even through Hyperdrive. It recommends an HTTP-based database driver.
- Cloudflare documents Hyperdrive as available on Workers Free, with a documented limit of 100,000 database statements per day. Better Auth's Cloudflare guidance still rules out treating a persistent module-scope `pg` pool as the solution.
- The existing Supabase Kysely toolkit is a type translator. Its examples use `pg` or `postgres`; it is not itself an HTTP PostgREST database driver.
- Better Auth supports custom database adapters. A request-safe HTTP/PostgREST adapter is a candidate, but it must pass the official adapter test suite before adoption.

## Decision

Do not install a conventional PostgreSQL pool into the Worker or initialize Better Auth at module scope with a connection-owning client.

Do not add production secrets, bindings, routes, or database changes during this investigation.

Evaluate these options in order:

1. **Request-safe PostgREST adapter:** implement a minimal Better Auth custom adapter over the staging project's Supabase Data API, using server-only credentials and a dedicated auth schema exposed only as required. Prove CRUD semantics, uniqueness, atomic one-time verification consumption, and failure behavior. Never expose the service credential to a browser.
2. **Request-scoped PostgreSQL client via Hyperdrive:** test only if Better Auth can construct and dispose of its database client per request without module-scope connection retention, and only after verifying this against current Better Auth runtime guidance.
3. **Separate portable PostgreSQL auth service:** consider only if the first two approaches cannot meet reliability and cost requirements. Avoid introducing a paid or card-required service.

A D1-backed implementation is not the default choice because it would introduce a Cloudflare-specific identity store and another migration boundary. Reconsider only if PostgreSQL options fail.

## Identity and RLS invariants

- Preserve existing user UUIDs where technically possible.
- Do not change or drop production `auth.users` rows, foreign keys, policies, triggers, or functions in this phase.
- The production database has 22 public-table foreign-key relationships to `auth.users`; every dependency must be mapped before a cutover design is accepted.
- The staging implementation must prove how Better Auth-issued JWTs map to the existing Supabase RLS identity model. Do not assume `auth.uid()` will work with an external JWT without an explicit hosted-staging test.
- Never authorize users from editable user metadata.
- Keep the existing Supabase Auth flow available in production until all acceptance tests pass and a separately approved migration plan exists.

## Required staging proof

1. Schema generation and migration into the isolated staging project only.
2. Better Auth adapter contract tests, including concurrent single-use verification consumption.
3. Google OAuth callback on a Scholars-owned hostname, using credentials supplied and controlled by the Scholars owner.
4. Email/password registration and login, email verification, password reset, and email OTP.
5. Existing password-hash compatibility proof before any production password migration is proposed.
6. UUID preservation and FK compatibility proof using synthetic staging fixtures only.
7. Supabase hosted-staging JWT verification and RLS tests for select, insert, update, and delete.
8. Cookie/session behavior through Next.js middleware and OpenNext on Cloudflare Workers.
9. Build and deployment-preview verification without changing the production Worker.
10. Rollback and account-recovery plan before any production cutover proposal.

## Acceptance gate

No production cutover is authorized by this ADR. Production migration requires a separate written plan, backup/restore validation, a complete account and FK mapping, a tested session reauthentication plan, and explicit owner approval.

## Official references

- Better Auth Cloudflare guide: https://better-auth.com/docs/guides/cloudflare
- Better Auth custom database adapter guide: https://better-auth.com/docs/guides/create-a-db-adapter
- Better Auth database concepts: https://better-auth.com/docs/concepts/database
- Better Auth relational database adapters: https://better-auth.com/docs/adapters/other-relational-databases
- Cloudflare Workers + Supabase: https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/
- Cloudflare Hyperdrive pricing: https://developers.cloudflare.com/hyperdrive/platform/pricing/
- Supabase Better Auth integration FAQ: https://supabase.com/kb/faqs/auth/better-auth-third-party-auth
