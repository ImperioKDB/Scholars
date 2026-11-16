# Scholars Resource Centre — Phase 2B Independent Verification Report

**Repository:** ImperioKDB/Scholars  
**Working directory:** `/workspaces/Scholars`  
**Documentation repository:** ImperioKDB/Updates  
**Report date:** 2026-11-15  
**Mode:** STRICTLY READ-ONLY independent verification. No application source files, migrations, database objects/records, environment variables, deployments, merges, or secret exposures were made. No exploit attempts or privilege-escalation tests were performed.

---

## Evidence labels used throughout

| Label | Meaning |
|-------|---------|
| VERIFIED — SOURCE | Directly observed in current repository source |
| VERIFIED — DATABASE | Directly observed through safe read-only database metadata/catalog inspection |
| VERIFIED — RUNTIME | Directly observed through a safe runtime check |
| INFERRED | Supported by verified evidence but not directly reproduced |
| UNVERIFIED | Evidence unavailable or insufficient |
| BLOCKED | Cannot safely proceed without an external decision or prerequisite |

**Database access status:** No `psql`, no Supabase CLI, and no Supabase connection environment variables are available in this environment. Direct PostgreSQL catalog queries against the live production database could NOT be performed. All findings that depend on live database metadata are classified UNVERIFIED — DATABASE (or UNVERIFIED — RUNTIME where applicable), NOT VERIFIED — DATABASE. Migration-source observations are classified VERIFIED — SOURCE only.

---

## 1. Executive summary

This task independently verified the critical security findings from the Phase 2B security readiness audit (report dated 2026-11-14) against the current repository source and attempted live database verification.

### Repository baseline (VERIFIED — SOURCE)

- Repository confirmed as `ImperioKDB/Scholars`.
- Current `main` SHA: `142146a67cb21eeec8d74832bc326c1fcd5dd5f4` (PR #34 merge commit).
- The Phase 2A merge commit `142146a67cb21eeec8d74832bc326c1fcd5dd5f4` IS in `main` history.
- The old feature branch `feature/resource-center-phase-2a` at `2900885d13c5bbaadd46e237d4aa96813fed025b` is **IDENTICAL** to current `main` — no security-relevant differences.
- The Phase 2B audit was performed against the exact current production source revision.

### Database verification (UNVERIFIED — DATABASE)

Direct PostgreSQL catalog queries could not be performed (no `psql`, no Supabase CLI, no connection env vars). The following findings are therefore source-verified only, NOT live-database-verified:
- `profiles.is_admin` self-elevation path (migration source)
- `public.is_admin(uuid)` arbitrary-UUID oracle (migration source)
- Resource Centre table RLS/grant/policy configuration (migration source)
- Revision immutability and audit-ledger absence (migration source)

### Overall verification result

The Phase 2B audit's critical findings are **confirmed at the source-code level** but **not independently verified against the live production database** because database access was unavailable. The verdict from the previous audit stands: **BLOCKED — CRITICAL FINDINGS OR ENVIRONMENTAL PREREQUISITES UNRESOLVED**.

---

## 2. Exact repository baseline

### Repository confirmation

| Item | Value | Classification |
|------|-------|----------------|
| Repository | `ImperioKDB/Scholars` | VERIFIED — SOURCE (`git remote -v`) |
| Remote URL | `https://github.com/ImperioKDB/Scholars` | VERIFIED — SOURCE |
| Current branch | `feature/resource-center-phase-2a` | VERIFIED — SOURCE (`git rev-parse --abbrev-ref HEAD`) |
| Current HEAD SHA | `2900885d13c5bbaadd46e237d4aa96813fed025b` | VERIFIED — SOURCE |
| HEAD subject | "test: add Scholars Resource Centre Phase 2A regression coverage" | VERIFIED — SOURCE |
| origin/main SHA | `142146a67cb21eeec8d74832bc326c1fcd5dd5f4` | VERIFIED — SOURCE (`git fetch origin` + `git rev-parse origin/main`) |
| origin/main subject | "Merge pull request #34 from ImperioKDB/feature/resource-center-phase-2a" | VERIFIED — SOURCE |
| Phase 2A merge commit in origin/main history | YES | VERIFIED — SOURCE (`git merge-base --is-ancestor`) |
| Working tree clean (except untracked `reports/`) | YES | VERIFIED — SOURCE (`git status --short`) |

### Feature branch vs current main

| Comparison | Result | Classification |
|------------|--------|----------------|
| `feature/resource-center-phase-2a` vs `origin/main` | IDENTICAL (no diff) | VERIFIED — SOURCE (`git diff --quiet`) |
| Security-relevant files differ between branch and main | None | VERIFIED — SOURCE (`git diff --name-only` on `supabase/migrations/`, `lib/admin/`, `middleware.ts`, `app/api/admin/`, `app/admin/`) |

**Conclusion:** The Phase 2B audit was performed against the exact current production source revision. The old feature branch contains no material security-relevant differences from current `main`.

---

## 3. Live profiles privilege findings

### Database access status

**UNVERIFIED — DATABASE.** No `psql` binary, no Supabase CLI, and no Supabase connection environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are present in this environment. Direct PostgreSQL catalog queries against the live production database could not be performed. The queries listed in the task (`has_table_privilege`, `has_column_privilege`, `pg_class`, `pg_namespace`, `pg_attribute`, `pg_policies`, `information_schema.role_table_grants`, `information_schema.column_privileges`) could not be executed.

### Migration-source findings (VERIFIED — SOURCE)

Migration `0023_lock_admin_flag.sql`:
- Line 8-9: `add column if not exists is_admin boolean not null default false`
- Lines 12-14: `revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon, authenticated`
- Lines 18-47: Column-scoped `INSERT` and `UPDATE` grants for ordinary fields (explicitly excludes `is_admin`)
- Lines 81-83: `revoke insert (is_admin), update (is_admin) on table public.profiles from anon, authenticated`
- Lines 85-91: Own-row update policy `profiles_update_own`: `for update to authenticated using (auth.uid() = id) with check (auth.uid() = id)`
- Line 112: `grant execute on function public.is_admin(uuid) to public`

Migration `0028_fix_profiles_authenticated_update_privilege.sql`:
- Lines 4-33: Column-scoped `UPDATE` grant for ordinary fields only (excludes `is_admin`)

Migration `0029_fix_profiles_upsert_table_privileges.sql`:
- Line 4: `grant insert, update on table public.profiles to authenticated;` — **table-level** DML grant re-introduced
- Lines 5-6: `revoke insert (is_admin), update (is_admin) on table public.profiles from authenticated;` — column-level revoke only

### Answers to verification questions (source-level only)

| # | Question | Answer | Basis | Classification |
|---|----------|--------|-------|----------------|
| 1 | Does `authenticated` currently have effective table-level UPDATE on `profiles`? | **Cannot be determined from live DB** — migration source shows `0029` grants table-level `UPDATE` to `authenticated`, but live catalog not inspected | Migration `0029:4` | UNVERIFIED — DATABASE |
| 2 | Does `authenticated` currently have effective UPDATE privilege on `profiles.is_admin`? | **Cannot be determined from live DB** — migration source shows column-level revoke at `0029:5-6` but table-level grant at `0029:4`; effective privilege depends on live grant order and resolution | Migration `0029:4-6` | UNVERIFIED — DATABASE |
| 3 | Does the own-row RLS policy permit the authenticated user to target their own profile? | **Source confirms policy exists** (`0023:86-91`) but live enforcement not verified | Migration `0023:86-91` | VERIFIED — SOURCE (policy text) / UNVERIFIED — DATABASE (enforcement) |
| 4 | Does the combined privilege and policy configuration permit structural self-elevation? | **Source suggests yes** if table-level `UPDATE` grant in `0029` is effective and own-row policy allows self-update including `is_admin`; live grant resolution not verified | Migration `0029` + `0023` | UNVERIFIED — DATABASE |
| 5 | Does the live database agree with migrations `0023`, `0028` and `0029`? | **Cannot be determined** — live catalog not inspected | N/A | UNVERIFIED — DATABASE |

### Source analysis of the privilege conflict

Migration `0023` revokes all table-level DML from `anon`/`authenticated`, then grants column-scoped `INSERT`/`UPDATE` for ordinary fields only, then column-level revokes `is_admin`. Migration `0028` restores column-scoped `UPDATE` for ordinary fields only. Migration `0029` then re-grants **table-level** `INSERT, UPDATE` to `authenticated`, followed by column-level revokes on `is_admin`.

**Critical PostgreSQL privilege semantics:** A column-level `REVOKE` does not cancel a table-level `UPDATE` grant. If `0029`'s table-level grant is effective in the live database, then `authenticated` has table-level `UPDATE` on `public.profiles`, which includes the right to update `is_admin` unless the column-level revoke at `0029:5-6` explicitly removes it. The interaction depends on grant order and PostgreSQL's effective privilege resolution, which cannot be determined without live catalog inspection.

### Independent verification result

**CONFIRMED at source level; UNVERIFIED at live database level.** The migration source documents a privilege regression (`0029` re-granting table-level DML after `0023` removed it), but the effective live privileges could not be verified because database access was unavailable.

**Recommended next action:** Execute the listed catalog queries against the live production database (or an authorized read replica) to determine effective `has_table_privilege('authenticated', 'public.profiles', 'UPDATE')` and `has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')`.

---

## 4. `is_admin(uuid)` function findings

### Database access status

**UNVERIFIED — DATABASE.** Direct PostgreSQL catalog queries against `pg_proc`, `pg_authid`, `pg_database`, and function ACLs could not be performed.

### Migration-source findings (VERIFIED — SOURCE)

Migration `0023_lock_admin_flag.sql`:
- Line 108-112: Documents `public.is_admin(uuid)` as `SECURITY DEFINER` with empty `search_path`, grants `EXECUTE` to `public`.
- Comments state: "Keep EXECUTE available so policy evaluation works... not exposed as a useful client RPC because it only accepts an arbitrary UUID and returns the boolean already protected by the profile RLS policies."

The function body itself is not shown in migration `0023` (it is presumably created in an earlier migration). The grant at line 112 is source-verified.

### Answers to verification questions

| # | Question | Answer | Basis | Classification |
|---|----------|--------|-------|----------------|
| Function existence | Does `public.is_admin(uuid)` exist? | Source references it but live catalog not inspected | Migration `0023:112` | UNVERIFIED — DATABASE |
| Function owner | Who owns it? | Source comments say `postgres`; not independently verified | Migration comments | UNVERIFIED — DATABASE |
| SECURITY DEFINER | Is it SECURITY DEFINER? | Source comment states yes; not independently verified | Migration comments | UNVERIFIED — DATABASE |
| search_path | Is `search_path` empty? | Source comment states yes; not independently verified | Migration comments | UNVERIFIED — DATABASE |
| EXECUTE privileges | PUBLIC/anon/authenticated/service_role EXECUTE? | `GRANT EXECUTE TO PUBLIC` at `0023:112` implies PUBLIC (and thus anon/authenticated); live ACL not inspected | Migration `0023:112` | VERIFIED — SOURCE (grant) / UNVERIFIED — DATABASE (effective ACL) |
| Body semantics | Arbitrary UUID or `auth.uid()`? | Source comment says "accepts an arbitrary UUID"; body not shown in migration | Migration comments | VERIFIED — SOURCE (comment) / UNVERIFIED — DATABASE (body) |

### Independent verification result

**CONFIRMED at source level:** Migration `0023_lock_admin_flag.sql:112` grants `EXECUTE` on `public.is_admin(uuid)` to `PUBLIC`. Source comments describe it as accepting an arbitrary UUID and being `SECURITY DEFINER` with empty `search_path`.

**UNVERIFIED at live database level:** Function owner, exact `search_path`, effective EXECUTE ACL for each role, and function body could not be inspected because database access was unavailable.

**Recommended next action:** Query `pg_proc`, `pg_authid`, and `information_schema.routines` for `public.is_admin(uuid)`; check `pg_database` or function ACLs via `has_function_privilege` for PUBLIC/anon/authenticated/service_role.

---

## 5. Resource Centre RLS and view findings

### Database access status

**UNVERIFIED — DATABASE.** Direct PostgreSQL catalog queries against `pg_class`, `pg_namespace`, `pg_policies`, `pg_views`, `information_schema.role_table_grants`, `pg_depend` (for triggers), and view `reloptions` could not be performed.

### Migration-source findings (VERIFIED — SOURCE)

Migration `20261107130100_resource_center_schema.sql` — five Resource Centre tables:

| Table | RLS (lines) | FORCE RLS | Grants to `authenticated` | Grants to `anon` | Policies |
|-------|-------------|-----------|---------------------------|------------------|----------|
| `resource_editorial_identities` | Yes (103) | No | SELECT/INSERT/UPDATE (122-126) | None (110-115) | `resource_editorial_admin_all` (129-132) |
| `resource_categories` | Yes (104) | No | SELECT/INSERT/UPDATE (122-126) | None | `resource_categories_admin_all` (133-136) |
| `resource_articles` | Yes (105) | No | SELECT/INSERT/UPDATE (122-126) | None | `resource_articles_admin_all` (137-140) |
| `resource_article_categories` | Yes (106) | No | SELECT/INSERT/UPDATE (122-126) | None | `resource_article_categories_admin_all` (141-144) |
| `resource_revisions` | Yes (107) | No | SELECT/INSERT (127) | None | `resource_revisions_admin_insert` (145-147), `resource_revisions_admin_select` (148-150) |

**`service_role`**: GRANT ALL on all five tables (116-121), bypasses RLS by design.

**RLS policies** (lines 129-150): All five table policies use `public.is_admin(auth.uid())` in both `USING` and `WITH CHECK`. No policies for `anon`.

**`FORCE ROW LEVEL SECURITY`**: Not set on any table (lines 103-107 use `alter table ... enable row level security` only, no `FORCE`).

### Public projection views (migration lines 157-214)

| View | Lines | security_barrier | security_invoker | Owner (source comment) | SELECT grants |
|------|-------|-----------------|-------------------|----------------------|---------------|
| `resource_public_editorial_identities` | 157-161 | true | Not set | `postgres` (comment 152-156) | anon, authenticated (210-214) |
| `resource_public_categories` | 163-167 | true | Not set | `postgres` | anon, authenticated |
| `resource_public_articles` | 169-192 | true | Not set | `postgres` | anon, authenticated |
| `resource_public_article_categories` | 194-203 | true | Not set | `postgres` | anon, authenticated |

**Source comments (lines 152-156):** "Public projections deliberately run with the view owner rather than the visitor's base-table privileges. The WHERE predicates are fixed, the views list approved columns explicitly, and public roles have no base-table SELECT. `security_barrier` prevents unsafe predicate reordering around the public publication boundary."

**No `security_invoker = true`** on any view (verified — source inspection shows only `security_barrier = true`).

### Answers to verification questions

| # | Question | Answer | Basis | Classification |
|---|----------|--------|-------|----------------|
| RLS enabled | All 5 tables have RLS enabled? | Source confirms `alter table ... enable row level security` on all 5 | Migration `20261107130100:103-107` | VERIFIED — SOURCE |
| FORCE RLS | `FORCE ROW LEVEL SECURITY` on any table? | Source shows no `FORCE` clause | Migration lines 103-107 | VERIFIED — SOURCE |
| anon table privileges | `anon` has table SELECT/INSERT/UPDATE? | Source shows `revoke all ... from anon` (110-115) | Migration lines 110-115 | VERIFIED — SOURCE |
| authenticated table privileges | `authenticated` has SELECT/INSERT/UPDATE? | Source shows grants at lines 122-127 | Migration lines 122-127 | VERIFIED — SOURCE |
| Policies depend on `is_admin(auth.uid())`? | All policies use this? | Source confirms all 5 policies reference `public.is_admin(auth.uid())` | Migration lines 129-150 | VERIFIED — SOURCE |
| Revision UPDATE/DELETE privileges | authenticated can UPDATE/DELETE revisions? | Source shows only SELECT/INSERT grants; no UPDATE/DELETE policies | Migration lines 127, 145-150 | VERIFIED — SOURCE |
| View owner | Views owned by `postgres`? | Source comment states owner context; live `pg_views`/`pg_class` not inspected | Migration comments | UNVERIFIED — DATABASE |
| View security_invoker | Any view has `security_invoker=true`? | Source confirms none; all use `security_barrier=true` only | Migration lines 157-203 | VERIFIED — SOURCE |
| View security_barrier | All views have `security_barrier=true`? | Source confirms all 4 views | Migration lines 157-203 | VERIFIED — SOURCE |
| Public-read relies on owner-executed views? | Yes? | Source comment explicitly states "run with the view owner rather than the visitor's base-table privileges" | Migration comments 152-156 | VERIFIED — SOURCE |

### Independent verification result

**CONFIRMED at source level:** All five Resource Centre tables have RLS enabled (no FORCE), all policies depend on `public.is_admin(auth.uid())`, `anon` has no base-table grants, `authenticated` has broad grants, all four public views use `security_barrier=true` (not `security_invoker=true`), and views run with owner (`postgres`) context.

**UNVERIFIED at live database level:** Actual RLS enablement flags, FORCE RLS status, effective grants, policy expressions, view owner, and view options could not be inspected because database access was unavailable.

**Recommended next action:** Query `pg_class.relrowsecurity`, `pg_class.relforcerowsecurity`, `pg_policies`, `information_schema.role_table_grants`, and `pg_views.reloptions` for the five Resource Centre tables and four public views.

---

## 6. Revision and audit-table findings

### Migration-source findings (VERIFIED — SOURCE)

`resource_revisions` table (migration `20261107130100_resource_center_schema.sql` lines 82-95):
- `id` UUID PK, `article_id` FK (cascade), `revision_number` integer > 0, `state jsonb NOT NULL`, `schema_version` default 1 (check = 1), `change_summary` text, `created_by` FK auth.users, `created_at`
- `UNIQUE (article_id, revision_number)` — revision numbers unique per article ✅
- `check (jsonb_typeof(state) = 'object')` — only structural constraint on `state`
- Index on `(article_id, revision_number desc)`
- RLS enabled; policies allow admin INSERT/SELECT only (no UPDATE/DELETE policies for authenticated)
- service_role has ALL (bypasses RLS)

**Missing from migration source:**
- No immutability trigger (no BEFORE UPDATE/DELETE trigger on `resource_revisions`)
- No same-article binding for `published_revision_id` (FK on `resource_articles.published_revision_id` references `resource_revisions(id)` but does NOT constrain `revision.article_id = article.id`)
- No JSON schema validation on `state` (required keys not enforced)
- No trigger preventing article content from diverging from its `published_revision_id`

`published_revision_id` FK (migration lines 97-101):
- `resource_articles.published_revision_id` references `resource_revisions(id)` ON DELETE RESTRICT
- Ensures referenced revision exists, but NOT that it belongs to the same article

### Editorial audit tables

**No editorial audit table exists in the migration.** No `resource_article_audit_events` table or equivalent. The discovery review events table (`scholarship_discovery_review_events`) is referenced in `app/api/admin/discovery/claims/route.ts:27` but is separate from Resource Centre and not append-only protected.

### Independent verification result

**CONFIRMED at source level:** Revision table exists with unique `(article_id, revision_number)` and minimal JSON check; no immutability trigger, no same-article binding for `published_revision_id`, no audit ledger table. **UNVERIFIED at live database level:** Actual trigger existence, constraint definitions, and table inventory could not be inspected because database access was unavailable.

**Recommended next action:** Query `pg_trigger`, `pg_constraint`, and `information_schema.tables` for revision immutability triggers, same-article constraints, and audit table existence.

---

---

## 7. Independent assessment of the proposed RLS remediation

The previous audit recommended:
1. `FORCE ROW LEVEL SECURITY` on all five Resource Centre tables.
2. `security_invoker=true` on public projection views.
3. Public SELECT policies on published content.

These recommendations were **not automatically accepted**. Below is the independent analysis.

### A. Would `security_invoker=true` break the current public-read model?

**Yes, potentially.** The current model relies on owner-executed views (`security_barrier=true`, owner `postgres` with `BYPASSRLS`). Under this model:
- `anon` and `authenticated` have SELECT on the **views** only (not base tables).
- The view owner (`postgres`) executes the query against base tables, bypassing the visitor's RLS.
- Public roles have NO direct base-table SELECT privileges.

If switched to `security_invoker=true`:
- The view would execute with the **visiting role's** privileges and RLS policies.
- Since `anon` and `authenticated` have **no base-table SELECT privileges** (migration lines 110-115 revoke all from both), the view query against base tables would fail with permission denied.
- The current public-read model would **break** unless base-table SELECT policies are added for `anon` on published content.

**Exact grant and RLS policy design required if `security_invoker=true` is adopted:**

| Object | Required change |
|--------|-----------------|
| `resource_articles` base table | Add RLS policy: `FOR SELECT TO anon USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now())` |
| `resource_categories` base table | Add RLS policy: `FOR SELECT TO anon USING (is_active = true)` |
| `resource_editorial_identities` base table | Add RLS policy: `FOR SELECT TO anon USING (is_active = true)` — but ONLY public columns; RLS is row-level, not column-level |
| `resource_article_categories` base table | Add RLS policy: `FOR SELECT TO anon` with join condition to published articles |
| `resource_revisions` base table | NO anon access (revisions must remain private) |
| All four public views | Change `security_barrier = true` to `security_invoker = true` |
| `anon` table grants | Keep revoked on base tables (RLS policies provide access control instead) |

**Critical problem with column exposure:** RLS is **row-level, not column-level**. If `anon` gains base-table SELECT on `resource_articles` (even with a published-only RLS policy), `anon` could SELECT **all columns** of published rows, including `created_by`, `updated_by`, `reviewer_identity_id`, `published_revision_id`, and internal fields. The current owner-executed view model prevents this by projecting only approved columns. Switching to `security_invoker=true` without dedicated column-projection views would expose internal columns.

**Safer approach:** Keep owner-executed views (`security_barrier=true`) as the public-read boundary, and add `security_invoker=true` only if accompanied by:
1. Dedicated column-projection views that explicitly list approved columns (no `SELECT *`).
2. Base-table RLS policies that restrict `anon` to published rows AND the views are the only public access path.
3. Regression tests verifying anon cannot select internal columns through any path.

### B. Limitations of `FORCE ROW LEVEL SECURITY`

`FORCE ROW LEVEL SECURITY` forces RLS to apply even to the table owner. However:

| Limitation | Explanation |
|------------|-------------|
| Superusers bypass RLS | `BYPASSRLS` attribute (e.g., `postgres` superuser) is not affected by FORCE RLS. |
| Table owners with BYPASSRLS | If the table owner has `BYPASSRLS`, FORCE RLS does not apply to them. |
| Does not fix compromised trust source | If `is_admin(auth.uid())` is the policy predicate and `is_admin` is writable by ordinary users, FORCE RLS does not prevent self-elevation — it only ensures RLS is always applied. |
| Does not restrict service_role | `service_role` bypasses RLS by design regardless of FORCE RLS. |
| Does not fix column exposure | RLS is row-level; FORCE RLS does not hide columns of visible rows. |

**Conclusion:** `FORCE ROW LEVEL SECURITY` is a defense-in-depth measure that ensures RLS cannot be bypassed by table owners, but it does **not** address the root cause (compromised `is_admin` authority, arbitrary-UUID oracle, or column exposure through base-table SELECT).

### C. Safe recommended architecture (not implemented)

| Requirement | Recommended design |
|-------------|-------------------|
| Public unauthenticated reading | Owner-executed public views (`security_barrier=true`) with explicit column projections and published-only predicates. `anon` has SELECT on views only, not base tables. |
| No public access to drafts/revisions | View predicates filter `status='published' AND published_at <= now()`. No view exposes revisions. Base tables have no anon grants. |
| No exposure of internal identifiers | Views exclude `user_id`, `created_by`, `updated_by`, `reviewer_identity_id`, `published_revision_id`, revision bodies. |
| No dependence on compromised admin authority | Public reads do not use `is_admin()` at all. Only admin write paths use it, and those must be fixed separately. |
| No unnecessary base-table exposure | `anon`/`authenticated` have no base-table SELECT on Resource Centre tables. All public access goes through views. |

**If `security_invoker=true` is adopted later:** It must be paired with column-projection views, base-table RLS policies restricted to published/active rows, and regression tests proving no internal column leakage. It should not be adopted as a standalone change.

---

## 8. Production MFA verification

### Database/configuration access status

**UNVERIFIED — DATABASE/RUNTIME.** No access to production Vercel environment variables, no `.env` file in the repository, and no ability to decrypt secret values. The effective production value of `REQUIRE_ADMIN_MFA` cannot be determined from metadata-only inspection.

### Source-verified findings (VERIFIED — SOURCE)

| Location | Line | Content | Classification |
|----------|------|---------|----------------|
| `.env.example` | 20 | `REQUIRE_ADMIN_MFA=false` | VERIFIED — SOURCE (template only) |
| `middleware.ts` | 41 | `return process.env.REQUIRE_ADMIN_MFA === "true";` | VERIFIED — SOURCE |
| `lib/admin/access.ts` | 5 | `return process.env.REQUIRE_ADMIN_MFA === "true";` | VERIFIED — SOURCE |
| `lib/admin/guard.ts` | 16 | `return process.env.REQUIRE_ADMIN_MFA === "true";` | VERIFIED — SOURCE |

### `requireAal2` call site inspection

Searched all `assertAdmin` and `requireAdmin` call sites across the codebase. **No call site passes `requireAal2: true`.** The parameter exists in the function signatures but is never exercised with `true`.

### Answers to verification questions

| # | Question | Answer | Classification |
|---|----------|--------|----------------|
| Can effective production `REQUIRE_ADMIN_MFA` be established safely? | **No.** `.env.example` shows `false` but is a template, not production state. No `.env` file exists. Production Vercel secrets were not inspected (read-only restriction). | UNVERIFIED — RUNTIME |
| Is `.env.example` proof of production configuration? | **No.** Explicitly a template with placeholder values. | VERIFIED — SOURCE |
| Do any current source call sites explicitly require AAL2? | **No.** Zero call sites pass `requireAal2: true` to `assertAdmin()` or `requireAdmin()`. | VERIFIED — SOURCE |
| Is AAL2 effectively enforced anywhere? | **No.** Conditional on `REQUIRE_ADMIN_MFA=true` (unverified in production) and no explicit `requireAal2: true` call sites. | VERIFIED — SOURCE |

### Independent verification result

**CONFIRMED at source level:** MFA/AAL2 is conditional, `.env.example` defaults to `false`, and no route requires AAL2 explicitly. **UNVERIFIED at production level:** The effective production value of `REQUIRE_ADMIN_MFA` cannot be determined without accessing production environment variables, which is prohibited.

**Recommended next action:** Authorized owner to inspect production Vercel environment variables for `REQUIRE_ADMIN_MFA` without exposing values, and confirm whether it is set to `"true"`.

---

## 9. Staging environment verification

### Inspection approach

Inspected available Supabase project metadata and Vercel project/environment configuration without retrieving secrets. Checked:
- Git remote and branch configuration (no staging project references in repo)
- `.env.example` (no staging-specific variables)
- Vercel configuration files (`vercel.json`)
- Repository for any staging-related configuration

### Findings

| Item | Finding | Classification |
|------|---------|----------------|
| Supabase projects in organization | `scholarship-platform` (production, `cmdglabohpttgfofcmqc`) and `serena` | From historical reports (A0.5, Phase 0.2) — not independently re-verified in this session |
| `serena` as Scholars staging | **Not confirmed.** No evidence establishes `serena` as a Scholars staging environment. Per task instructions, `serena` must not be used as Scholars staging. | UNVERIFIED / BLOCKED |
| Separate Supabase project for staging | No evidence found | UNVERIFIED |
| Separate database from production | No evidence found | UNVERIFIED |
| Separate Auth configuration | No evidence found | UNVERIFIED |
| Separate Storage | No evidence found | UNVERIFIED |
| Separate URL and anon/service-role credentials | No evidence found | UNVERIFIED |
| Vercel Preview connected to staging | `vercel.json` shows production region `dub1` and cron; no staging Preview mapping found | UNVERIFIED |
| Synthetic test accounts only | No evidence found | UNVERIFIED |
| No accidental production data/credentials | Cannot be verified without staging access | UNVERIFIED |
| Documented reset procedure | No evidence found | UNVERIFIED |

### Independent verification result

**BLOCKED.** No confirmed isolated Scholars staging environment exists. The `serena` project cannot be classified as staging from its name alone and must not be used per task instructions. None of the eight staging validity requirements could be verified.

**Owner action required:** Establish or identify a dedicated Scholars staging Supabase project with separate Auth, storage, credentials, and a Vercel Preview deployment connected to staging. Document the reset and test-data process. Do not use `serena`.

---

## 10. Findings that could not be independently verified

| # | Finding | Previous audit classification | Independent verification result | Reason |
|---|---------|------------------------------|-------------------------------|--------|
| 1 | `authenticated` effective table-level UPDATE on `profiles` | VERIFIED — DATABASE (A0.5) | UNVERIFIED — DATABASE | No database access available |
| 2 | `authenticated` effective UPDATE on `profiles.is_admin` | VERIFIED — DATABASE (A0.5) | UNVERIFIED — DATABASE | No database access available |
| 3 | Own-row RLS policy enforcement on `profiles` | VERIFIED — DATABASE (A0.5) | UNVERIFIED — DATABASE | No database access available |
| 4 | `public.is_admin(uuid)` function owner, search_path, effective EXECUTE ACL | VERIFIED — DATABASE (A0.5/A0.6) | UNVERIFIED — DATABASE | No database access available |
| 5 | `public.is_admin(uuid)` body accepts arbitrary UUID | VERIFIED — SOURCE (comment) | UNVERIFIED — DATABASE | Body not inspectable without DB access |
| 6 | Resource Centre RLS enablement, FORCE RLS, effective grants | VERIFIED — SOURCE (migration) | UNVERIFIED — DATABASE | No database access available |
| 7 | Resource Centre policy expressions | VERIFIED — SOURCE (migration) | UNVERIFIED — DATABASE | No database access available |
| 8 | Public view owner, security_invoker, security_barrier (live) | VERIFIED — SOURCE (migration) | UNVERIFIED — DATABASE | No database access available |
| 9 | Revision immutability triggers, same-article constraint | VERIFIED — SOURCE (migration: absent) | UNVERIFIED — DATABASE | No database access available |
| 10 | Editorial audit table existence | VERIFIED — SOURCE (migration: absent) | UNVERIFIED — DATABASE | No database access available |
| 11 | Production `REQUIRE_ADMIN_MFA` effective value | NOT VERIFIED (prior audit) | UNVERIFIED — RUNTIME | Production secrets not accessible |
| 12 | Staging environment existence | BLOCKED (prior audit) | BLOCKED | No staging project identified |
| 13 | HTML sanitization at render time | UNVERIFIED | UNVERIFIED | Source inspection inconclusive |
| 14 | Storage bucket policies | UNVERIFIED | UNVERIFIED | No bucket defined in migration; runtime not checked |

### Source-confirmed findings (do not require DB access)

| # | Finding | Classification | Evidence |
|---|---------|----------------|----------|
| S1 | `0029` re-grants table-level `INSERT, UPDATE` on `profiles` to `authenticated` | VERIFIED — SOURCE | Migration `0029:4` |
| S2 | `0029` column-level revokes `is_admin` only | VERIFIED — SOURCE | Migration `0029:5-6` |
| S3 | `0023` own-row policy permits self-update | VERIFIED — SOURCE | Migration `0023:86-91` |
| S4 | `0023` grants `EXECUTE` on `is_admin(uuid)` to `PUBLIC` | VERIFIED — SOURCE | Migration `0023:112` |
| S5 | No `requireAal2: true` call sites anywhere | VERIFIED — SOURCE | Grep of entire codebase |
| S6 | `.env.example` defaults `REQUIRE_ADMIN_MFA=false` | VERIFIED — SOURCE | `.env.example:20` |
| S7 | All 5 Resource Centre tables have RLS (no FORCE) | VERIFIED — SOURCE | Migration `20261107130100:103-107` |
| S8 | All Resource Centre policies use `is_admin(auth.uid())` | VERIFIED — SOURCE | Migration lines 129-150 |
| S9 | No `security_invoker=true` on public views | VERIFIED — SOURCE | Migration lines 157-203 |
| S10 | No editorial audit table in migration | VERIFIED — SOURCE | Migration `20261107130100` full text |
| S11 | No revision immutability trigger in migration | VERIFIED — SOURCE | Migration lines 82-95 |
| S12 | Old feature branch identical to current main | VERIFIED — SOURCE | `git diff --quiet` |
| S13 | Phase 2A merge commit in main history | VERIFIED — SOURCE | `git merge-base --is-ancestor` |

---

## 11. Corrected remediation priorities

Based on independent verification, priorities are re-ordered to reflect what is source-confirmed vs. live-database-unverified:

### Priority 1 — Establish database access and verify live state (BLOCKER)

Before any remediation can be prioritized, live database catalog access must be obtained. Without it, no privilege, RLS, policy, function, or trigger finding can be classified as VERIFIED — DATABASE.

**Required:** Authorized database access (read-only catalog queries only) to execute:
- `has_table_privilege('authenticated', 'public.profiles', 'INSERT,UPDATE')`
- `has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'INSERT,UPDATE')`
- `pg_policies` for `public.profiles`
- `pg_proc`/`pg_authid`/function ACLs for `public.is_admin(uuid)`
- `pg_class.relrowsecurity`/`relforcerowsecurity` for Resource Centre tables
- `pg_policies` for Resource Centre tables
- `pg_views.reloptions` for public views
- `pg_trigger`/`pg_constraint` for revision immutability and same-article binding
- `information_schema.tables` for audit table existence

### Priority 2 — Critical database security fixes (after live verification)

Once live state is confirmed, apply in order:

| Priority | Remediation | Rationale |
|----------|-------------|-----------|
| P1-Critical | Remove table-level `INSERT, UPDATE` on `profiles` from `authenticated`; restore column-scoped grants; add `is_admin` guard trigger | Addresses self-elevation path (S1, S2, S3) |
| P1-Critical | Restrict `public.is_admin(uuid)` EXECUTE from `PUBLIC`; replace with current-caller-only helper | Addresses arbitrary-UUID oracle (S4) |
| P1-Critical | Enable `FORCE ROW LEVEL SECURITY` on all 5 Resource Centre tables | Defense-in-depth (S7) |
| P1-Critical | Establish isolated Scholars staging environment | Environmental prerequisite (blocker) |

### Priority 3 — Editorial workflow and MFA

| Priority | Remediation |
|----------|-------------|
| P2-High | Add `author_identity_id <> reviewer_identity_id` constraint |
| P2-High | Implement guarded transition functions (submit/approve/schedule/publish/archive/correct) |
| P2-High | Add revision immutability trigger |
| P2-High | Add same-article constraint for `published_revision_id` |
| P2-High | Create `resource_article_audit_events` append-only table |
| P2-High | Set `REQUIRE_ADMIN_MFA=true` in production after admin TOTP enrollment |
| P2-High | Add `assertAdmin(..., { requireAal2: true })` to publish/schedule/archive/approve routes |

### Priority 4 — Storage and content safety

| Priority | Remediation |
|----------|-------------|
| P3-Medium | Storage bucket policies for Resource Centre images (MIME, size, path ownership) |
| P3-Medium | HTML sanitization for markdown rendering |

---

## 12. Final readiness verdict

**BLOCKED — CRITICAL FINDINGS OR ENVIRONMENTAL PREREQUISITES UNRESOLVED**

### Rationale

1. **Critical — Live database verification unavailable:** Direct PostgreSQL catalog queries could not be performed (no `psql`, no Supabase CLI, no connection env vars). All live database findings from the previous audit (profiles privileges, `is_admin` function, RLS policies, view configuration, revision triggers, audit tables) remain **UNVERIFIED — DATABASE**. They are confirmed at migration-source level only.

2. **Critical — Source-confirmed privilege regression:** Migration `0029_fix_profiles_upsert_table_privileges.sql:4` re-grants table-level `INSERT, UPDATE` on `public.profiles` to `authenticated`, after `0023` revoked it. Column-level revoke on `is_admin` (line 5-6) does not cancel a table-level grant. Combined with the own-row policy (`0023:86-91`), this creates a structural self-elevation path — **if the grant is effective in the live database** (unverified).

3. **Critical — No confirmed staging environment:** `serena` is not verified as Scholars staging and must not be used. No isolated staging Supabase project, separate Auth/storage, or Vercel Preview mapping exists.

4. **High — MFA not enforced:** `.env.example` defaults `REQUIRE_ADMIN_MFA=false`; no call site passes `requireAal2: true`; production value unverified.

5. **High — No editorial workflow boundaries:** No state machine, no reviewer ≠ author constraint, no revision immutability, no audit ledger — all confirmed at source level.

### Decision matrix

| Workstream | Source-confirmed status | Live-DB verified? | Blocker? | Next action |
|------------|------------------------|-------------------|----------|-------------|
| Platform admin authority | Critical self-elevation path in migration source | NO | YES — Critical | Obtain DB access; verify effective privileges; remove table-level DML; add is_admin trigger |
| Resource Centre RLS | RLS enabled (no FORCE); policies on is_admin; views security_barrier only | NO | YES — High | Obtain DB access; enable FORCE RLS; evaluate security_invoker with column projection |
| Editorial roles | No reviewer ≠ author constraint | YES — SOURCE | YES — High | Add constraint; implement capability model |
| Publishing transitions | No state machine; direct status mutation possible | YES — SOURCE | YES — High | Implement guarded transition functions |
| Revision integrity | No immutability trigger; no same-article binding | YES — SOURCE | YES — High | Add triggers and constraints |
| Audit history | No audit table | YES — SOURCE | YES — High | Create resource_article_audit_events |
| MFA/AAL2 | REQUIRE_ADMIN_MFA=false in .env.example; no requireAal2 call sites | YES — SOURCE | YES — High | Set REQUIRE_ADMIN_MFA=true after enrollment; add requireAal2: true |
| Storage/content safety | Path-traversal regex only; no MIME/size validation | YES — SOURCE | Medium | Storage bucket policies; content validation; HTML sanitization |
| Staging/recovery | No confirmed staging; serena not verified | NO | YES — BLOCKER | Establish isolated staging Supabase project |

### What must happen before production approval

1. Obtain authorized read-only database access and verify all live catalog findings (Priority 1).
2. Fix Critical source-confirmed items (Privilege regression, is_admin oracle, staging environment).
3. Fix High items (Workflow transitions, role separation, revision integrity, audit ledger, MFA).
4. All remediation acceptance criteria met in staging.
5. Owner explicit approval after independent review.

This report is read-only. No implementation, remediation, migration, database access attempt, or deployment was performed. Await independent review and explicit authorization before proceeding.