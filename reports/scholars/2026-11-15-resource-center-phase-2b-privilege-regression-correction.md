# Scholars Resource Centre — Phase 2B Privilege Regression Correction Report

**Repository:** ImperioKDB/Scholars  
**Reports repository:** ImperioKDB/Updates  
**Report date:** 2026-11-15  
**Mode:** READ-ONLY. No application source files, migrations, database objects/records, environment variables, deployments, merges, or secret exposures were made. No exploit attempts or privilege-escalation tests were performed. The SQL script in this report has NOT been executed against any database.

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

**Database access status:** No `psql`, no Supabase CLI, and no Supabase connection environment variables are available in this environment. Direct PostgreSQL catalog queries against the live production database could NOT be performed. All live-database findings are classified UNVERIFIED — DATABASE. Migration-source observations are classified VERIFIED — SOURCE only.

---

## 1. Executive summary

This report corrects the PostgreSQL privilege interpretation in the prior Phase 2B independent verification report (2026-11-15). The prior report incorrectly suggested that the effectiveness of the `profiles.is_admin` privilege combination depends on migration grant order. **It does not.** PostgreSQL privilege semantics establish that a column-level REVOKE cannot cancel a table-level UPDATE grant. If `authenticated` retains table-level UPDATE on `public.profiles` (as granted by migration `0029_fix_profiles_upsert_table_privileges.sql:4`), that privilege includes UPDATE on `profiles.is_admin`, notwithstanding the column-level revoke at `0029:5-6`.

Combined with the own-row RLS policy (`profiles_update_own`, `auth.uid() = id`) from migration `0023_lock_admin_flag.sql:86-91`, an ordinary authenticated user can structurally change their own `is_admin` value through any database-supported write path — **if the table-level grant is effective in the live database** (which remains UNVERIFIED — DATABASE because live catalog access was unavailable).

No migration after `0029` revokes the table-level INSERT/UPDATE grant on `public.profiles` from `authenticated`. A chronological migration timeline is provided in Section 4.

A read-only production verification SQL script has been published for manual execution through the Supabase SQL Editor. It has NOT been executed. The SQL file is published at commit `5f4af4f2c96141a8a920288046952c3f6e189a67`.

**Final verdict:** BLOCKED — CRITICAL FINDINGS OR ENVIRONMENTAL PREREQUISITES UNRESOLVED (live verification pending).

---

## 2. Exact repository baseline

| Item | Value | Classification |
|------|-------|----------------|
| Repository | `ImperioKDB/Scholars` | VERIFIED — SOURCE (`git remote -v`) |
| Remote URL | `https://github.com/ImperioKDB/Scholars` | VERIFIED — SOURCE |
| Current `main` SHA | `142146a67cb21eeec8d74832bc326c1fcd5dd5f4` | VERIFIED — SOURCE (`git rev-parse origin/main`) |
| `main` subject | "Merge pull request #34 from ImperioKDB/feature/resource-center-phase-2a" | VERIFIED — SOURCE |
| Phase 2A merge commit in `main` history | YES | VERIFIED — SOURCE (`git merge-base --is-ancestor`) |
| Working tree clean | YES (except untracked `reports/`) | VERIFIED — SOURCE (`git status --short`) |
| Migration directory | `supabase/migrations/` — 127 files | VERIFIED — SOURCE (`ls`) |

The inspection was performed against the exact current production source revision. No branch switch or destructive Git command was used.

---

## 3. Correct PostgreSQL privilege explanation

### 3.1 Table-level vs column-level privileges

In PostgreSQL, privileges on a table can be granted at two levels:

- **Table-level privilege:** Applies to all columns of the table. Example: `GRANT UPDATE ON TABLE public.profiles TO authenticated;` grants the right to update any column of any row (subject to RLS).
- **Column-level privilege:** Applies to a specific column. Example: `GRANT UPDATE (full_name) ON TABLE public.profiles TO authenticated;` grants the right to update only the `full_name` column.

### 3.2 Why a column-level REVOKE cannot cancel an existing table-level UPDATE grant

**This is the key correction.** PostgreSQL privilege semantics state:

> A column-level `REVOKE` removes only the column-level privilege. It does **not** remove a table-level privilege on the same table.

If `authenticated` has been granted table-level `UPDATE` on `public.profiles`, then `authenticated` can update **every column** of `profiles`, including `is_admin`. A subsequent `REVOKE UPDATE (is_admin) ON TABLE public.profiles FROM authenticated;` only removes any column-level UPDATE privilege that might have been separately granted on `is_admin`. It does **not** diminish the table-level UPDATE privilege.

Therefore:
- `0023_lock_admin_flag.sql:12-14` revokes all table-level DML from `anon, authenticated`.
- `0029_fix_profiles_upsert_table_privileges.sql:4` **re-grants** table-level `INSERT, UPDATE` to `authenticated`.
- `0029:5-6` revokes column-level INSERT/UPDATE on `is_admin` — but this **cannot cancel** the table-level grant from `0029:4`.
- **Net effect:** `authenticated` retains effective table-level UPDATE on `public.profiles`, which includes UPDATE on `profiles.is_admin`.

This interpretation is **not dependent on grant order**. It follows directly from PostgreSQL's documented privilege semantics. The earlier report's suggestion that effectiveness depends on grant order was incorrect.

### 3.3 Role membership and inherited privileges

Roles in PostgreSQL can inherit privileges from other roles they are members of. If `authenticated` is a member of a role that has table-level UPDATE on `public.profiles`, `authenticated` inherits that privilege. The `PUBLIC` role is a special role that every database user is implicitly a member of. Any privilege granted to `PUBLIC` is available to all roles, including `anon`, `authenticated`, and `service_role`.

### 3.4 How PUBLIC grants affect anon and authenticated

`GRANT ... TO PUBLIC` makes the privilege available to every database role. `PUBLIC` is a special PostgreSQL pseudo-role — privileges granted to it are automatically available to all database roles, including `anon`, `authenticated`, and `service_role`. This does **not** mean every role appears as an ordinary membership entry in `pg_auth_members`; `PUBLIC` membership is implicit and is not recorded as a row in `pg_auth_members`. The direct path for explicit grants is to grant to `anon` and `authenticated` individually, as seen in migration `0029:4`.

### 3.5 Why RLS policies do not replace SQL privileges

Row-Level Security (RLS) and SQL privileges are **independent, layered controls**:

1. **SQL privilege check first:** PostgreSQL first checks whether the role has the required SQL privilege (e.g., UPDATE on the table or column). If the privilege is missing, the operation is rejected immediately, before RLS is evaluated.
2. **RLS check second:** If the SQL privilege check passes, PostgreSQL then evaluates RLS policies to determine which rows are visible or modifiable.

Having UPDATE permission on the table does **not** bypass RLS — but lacking UPDATE privilege means RLS is never reached. RLS policies restrict **which rows** can be accessed; SQL privileges determine **whether** the operation can be attempted at all.

### 3.6 Why UPDATE permission and satisfying an UPDATE policy are separate requirements

For an UPDATE to succeed on a row visible through RLS:

1. The role must have SQL UPDATE privilege on the table (or the specific column).
2. The role must satisfy the RLS USING policy for the row being read (to see it).
3. The role must satisfy the RLS WITH CHECK policy for the new values (to write them).

If `authenticated` has table-level UPDATE on `public.profiles` (requirement 1 met) and the own-row policy `profiles_update_own` (`auth.uid() = id`) permits the user to update their own row (requirements 2 and 3 met for their own row), then an ordinary authenticated user can UPDATE their own `is_admin` value to `true`. The database has no structural barrier preventing this.

---

## 4. Complete migration timeline

### 4.1 Migrations affecting profiles privileges and is_admin

| # | Migration | Date/Position | Key SQL and line numbers | Effect on is_admin privilege |
|---|-----------|---------------|-------------------------|------------------------------|
| 1 | `0002_harden_functions.sql` | Before 0023 | Line 8: `alter function is_admin(uuid) set search_path = '';`<br>Lines 10-12: `revoke execute on function is_admin(uuid) from public, anon, authenticated;` | Revokes EXECUTE on `is_admin(uuid)` from PUBLIC/anon/authenticated |
| 2 | `0023_lock_admin_flag.sql` | After 0002 | Line 9: `add column if not exists is_admin boolean not null default false;`<br>Lines 12-14: `revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon, authenticated;`<br>Lines 18-47: Column-scoped INSERT/UPDATE grants for ordinary fields (excludes `is_admin`)<br>Lines 81-83: `revoke insert (is_admin), update (is_admin) on table public.profiles from anon, authenticated;`<br>Lines 85-91: Creates own-row update policy `profiles_update_own` using `auth.uid() = id`<br>Line 112: `grant execute on function public.is_admin(uuid) to public;` | Removes table-level DML; grants column-scoped access; creates own-row policy; column-level revokes `is_admin`; **re-grants EXECUTE on is_admin to PUBLIC** (reversing 0002) |
| 3 | `0028_fix_profiles_authenticated_update_privilege.sql` | After 0023 | Lines 4-33: `grant update (full_name, ..., last_seen_at) on table public.profiles to authenticated;` (ordinary fields only, excludes `is_admin`) | Restores column-scoped UPDATE for ordinary fields; does not affect `is_admin` |
| 4 | `0029_fix_profiles_upsert_table_privileges.sql` | After 0028 | Line 4: `grant insert, update on table public.profiles to authenticated;`<br>Lines 5-6: `revoke insert (is_admin), update (is_admin) on table public.profiles from authenticated;` | **Re-grants table-level INSERT, UPDATE to authenticated** ← THE REGRESSION<br>Column-level revoke on `is_admin` cannot cancel table-level grant |
| 5 | `0056_add_community_layer.sql` | After 0029 | Line 20: `grant update (community_role) on public.profiles to authenticated;` | Column-level grant on `community_role` only; does not affect `is_admin` |
| 6 | `0061_add_contributor_profiles.sql` | After 0029 | Line 6: `grant update (community_bio) on table public.profiles to authenticated;` | Column-level grant on `community_bio` only; does not affect `is_admin` |
| 7 | `0094_guard_community_invitation_consent.sql` | After 0029 | Lines 38-41: Creates `BEFORE INSERT OR UPDATE` trigger `guard_community_invitation_consent` on `public.profiles`<br>Trigger only guards `whatsapp_community_invite_*` fields, NOT `is_admin` | Trigger does not protect `is_admin` |
| 8 | `20261107130000_security_boundary_remediation.sql` | After 0029 | Revokes function execution on worker functions from public/anon/authenticated; alters default privileges for future objects | Does **not** revoke table-level INSERT/UPDATE on `public.profiles` from `authenticated` |

### 4.2 Migrations after 0029 that mention profiles or is_admin (no corrective action)

The following migrations after 0029 reference `profiles` or `is_admin` but **do not revoke** the table-level grant from `0029`:

- `0034_add_retention_foundations.sql` — references `is_admin` in RLS policies (reads only)
- `0035_add_discussion_admin_policies.sql` — references `p.is_admin = true` (reads only)
- `0039_add_reengagement_experiment_assignments.sql` — references `is_admin(auth.uid())` (reads only)
- `0045_add_admin_metrics_summary.sql` — references `is_admin(auth.uid())` (reads only)
- `0052_hide_expired_scholarships_preserve_saved_tracking.sql` — references `is_admin(auth.uid())` (reads only)
- `0056_add_community_layer.sql` — column-level GRANT UPDATE (community_role) only
- `0057_add_monitoring_error_events.sql` — references `is_admin(auth.uid())` (reads only)
- `0058_complete_prompt_attribution.sql` — references `is_admin(auth.uid())` (reads only)
- `0061_harden_scholarship_verification_agent.sql` — references `public.is_admin(actor_id)` (reads only)
- `0064_complete_discovery_trust_path.sql` — references `public.is_admin(actor_id)` (reads only)
- `0065_add_claim_review_policies.sql` — references `is_admin(auth.uid())` (reads only)
- `0066_require_current_freshness_for_publication.sql` — references `public.is_admin(actor_id)` (reads only)
- `0072_add_provider_analytics.sql` — references `is_admin(auth.uid())` (reads only)
- `0073_fix_provider_analytics_acquisition.sql` — references `public.is_admin(auth.uid())` (reads only)
- `0075_flag_expired_opportunities.sql` — references `p.is_admin = true` (reads only)
- `0078_scope_provider_analytics_to_reporting_window.sql` — references `public.is_admin(auth.uid())` (reads only)
- `0082_harden_provider_analytics.sql` — references `public.is_admin(auth.uid())` (reads only)
- `0086_add_daily_visitor_metrics.sql` — references `public.is_admin(auth.uid())` (reads only)
- `0103_add_confirmation_email_analytics.sql` — references `public.is_admin(auth.uid())` (reads only)
- `20261111032810_global_opportunity_access_hardening.sql` — references `public.is_admin(auth.uid())` (reads only)
- `20261107130100_resource_center_schema.sql` — references `public.is_admin(auth.uid())` in Resource Centre policies (reads only)

### 4.3 Search results for corrective statements after 0029

| Search pattern | Matches after 0029 | Conclusion |
|----------------|-------------------|------------|
| `REVOKE.*UPDATE.*public.profiles` | 0 | No migration revokes table-level UPDATE on profiles after 0029 |
| `REVOKE.*INSERT.*public.profiles` | 0 | No migration revokes table-level INSERT on profiles after 0029 |
| `REVOKE.*ON TABLE.*public.profiles` | 0 | No migration revokes any table-level privilege on profiles after 0029 |
| `REVOKE.*ALL.*profiles` | 0 | No migration revokes ALL privileges on profiles after 0029 |
| `FORCE ROW LEVEL SECURITY` on profiles | 0 | No migration enables FORCE RLS on profiles |
| Changes to `profiles_update_own` after 0023 | 0 | No migration modifies the own-row update policy after 0023 |
| Triggers protecting `profiles.is_admin` | 0 | No trigger protects `is_admin` specifically |

### 4.4 Chronological privilege timeline

1. **`0002_harden_functions.sql`**: Revokes EXECUTE on `is_admin(uuid)` from PUBLIC/anon/authenticated. Sets `search_path = ''`.
2. **`0023_lock_admin_flag.sql`**: Adds `is_admin` column (default false). Revokes all table-level DML from anon/authenticated. Grants column-scoped INSERT/UPDATE for ordinary fields. Column-level revokes `is_admin`. Creates own-row RLS policy. **Re-grants EXECUTE on `is_admin(uuid)` to PUBLIC** (line 112).
3. **`0028_fix_profiles_authenticated_update_privilege.sql`**: Restores column-scoped UPDATE for ordinary fields only.
4. **`0029_fix_profiles_upsert_table_privileges.sql`**: **Re-grants table-level INSERT, UPDATE to `authenticated`** (line 4). Column-level revokes `is_admin` (lines 5-6) — **cannot cancel table-level grant**.
5. **`0056_add_community_layer.sql`**: Column-level GRANT UPDATE (community_role) to authenticated.
6. **`0061_add_contributor_profiles.sql`**: Column-level GRANT UPDATE (community_bio) to authenticated.
7. **`0094_guard_community_invitation_consent.sql`**: Creates trigger on profiles for community invitation fields only — does not protect `is_admin`.
8. **`20261107130000_security_boundary_remediation.sql`**: Revokes function execution on worker functions only — does not touch table privileges on profiles.

**No migration after 0029 revokes the table-level INSERT/UPDATE grant on `public.profiles` from `authenticated`.**

---

## 5. Whether later migrations correct the issue

**No.** No migration after `0029_fix_profiles_upsert_table_privileges.sql` revokes the table-level INSERT/UPDATE grant on `public.profiles` from `authenticated`. The column-level revoke at `0029:5-6` cannot cancel the table-level grant at `0029:4` under PostgreSQL privilege semantics. The issue remains uncorrected in the migration history.

---

## 6. Source-level conclusion

Based on migration source inspection (VERIFIED — SOURCE):

1. Migration `0029_fix_profiles_upsert_table_privileges.sql:4` grants table-level `INSERT, UPDATE` on `public.profiles` to `authenticated`.
2. Migration `0029:5-6` column-level revokes INSERT/UPDATE on `is_admin` — this **cannot cancel** the table-level grant.
3. Migration `0023_lock_admin_flag.sql:86-91` creates an own-row RLS policy (`auth.uid() = id`) permitting a user to update their own profile row.
4. **Combined effect:** If the table-level grant is effective in the live database, an ordinary authenticated user can structurally change their own `is_admin` value to `true` through any database-supported write path (PostgREST upsert, direct SQL, etc.).
5. No subsequent migration corrects this issue.
6. The `public.is_admin(uuid)` function has `EXECUTE` granted to `PUBLIC` (`0023:112`), making it an arbitrary-UUID membership oracle — **if the grant is effective in the live database**.

**Classification:** VERIFIED — SOURCE (migration documents the grant). The **effective live database state** is UNVERIFIED — DATABASE because direct catalog access was unavailable.

---

## 7. Production verification SQL and its path

A refined read-only SQL script has been published for manual execution through the Supabase SQL Editor. It contains SELECT statements only and does not modify any database object, read profile rows, or expose secrets.

**File path:** `reports/scholars/sql/2026-11-15-resource-center-read-only-security-verification.sql`  
**Repository:** ImperioKDB/Updates  
**SQL publication commit SHA:** `5f4af4f2c96141a8a920288046952c3f6e189a67`  
**Status:** Published. **NOT executed.**

### What the script checks

| Section | Check | Method |
|---------|-------|--------|
| A | Schema USAGE and CREATE privilege on `public` for anon/authenticated/service_role/public | `has_schema_privilege()` |
| B | Role membership inspection via `pg_auth_members` and `pg_roles` | Catalog queries (replaces invalid `pg_has_role` calls) |
| C.1 | Table-level INSERT/UPDATE on `public.profiles` for anon/authenticated/service_role/public | `has_table_privilege()` |
| C.2 | Column-level INSERT/UPDATE on `profiles.is_admin` for each role | `has_column_privilege()` |
| C.3 | Column-level UPDATE on ordinary fields (e.g., `full_name`) for comparison | `has_column_privilege()` |
| D.1 | RLS enabled and FORCE RLS status on `profiles` | `pg_class.relrowsecurity`, `relforcerowsecurity` |
| D.2 | RLS policies on `profiles` — ALL policy roles expanded (USING, WITH CHECK) | `pg_policy` catalog with `unnest(polroles)` |
| D.3 | Effective table grants on `profiles` | `information_schema.role_table_grants` |
| D.4 | Effective column grants on `profiles.is_admin` | `information_schema.column_privileges` |
| E.1 | Function existence, owner, SECURITY DEFINER, configuration (search_path) | `pg_proc` catalog |
| E.2 | Effective EXECUTE privilege on `is_admin(uuid)` for each role | `has_function_privilege()` |
| E.3 | Raw function ACL | `pg_proc.proacl` |

### Changes made to the SQL script in this revision

1. **Corrected `pg_auth_members` column interpretation:** PostgreSQL defines `m.member` as the member role and `m.roleid` as the granted role — the opposite of what earlier versions of this script assumed. Section B now correctly maps `m.member` → member_role and `m.roleid` → granted_role.

2. **Version-compatible membership fields:** The `inherit_option` and `set_option` columns are PostgreSQL 16+ additions and do not exist on older versions. They are now accessed via `to_jsonb(m)->>'inherit_option'` and `to_jsonb(m)->>'set_option'`, which return NULL when the columns are absent rather than failing the query. `admin_option` is retained as it is available across relevant versions.

3. **Removed invalid `pg_has_role` checks:** The previous script used `pg_has_role('anon', 'public', 'member')` and `pg_has_role('authenticated', 'public', 'inheritable')`. Both are invalid:
   - `PUBLIC` is a PostgreSQL pseudo-role, not an ordinary role-membership target. It must not be queried through `pg_has_role` as if it were a regular role.
   - `'inheritable'` is not a valid `pg_has_role` privilege argument. Supported arguments are `MEMBER`, `USAGE`, and `SET`.

4. **Replaced with `pg_auth_members` + `pg_roles` inspection:** Section B now queries `pg_auth_members` directly to report every direct membership relationship involving `anon`, `authenticated`, and `service_role` (as either member or granted role). It also queries `pg_roles` to report role attributes (can_login, inherits_by_default, is_superuser). These catalogs are available in all supported PostgreSQL versions and avoid the invalid `pg_has_role` usage.

5. **Corrected PUBLIC pseudo-role spelling:** All `has_table_privilege`, `has_column_privilege`, `has_schema_privilege`, and `has_function_privilege` calls use lowercase `'public'` (the documented PostgreSQL pseudo-role argument).

6. **Expanded policy role reporting:** Section D.2 uses `unnest(polroles)` with `CROSS JOIN LATERAL` to expand and report every role assigned to each RLS policy, including `PUBLIC` (OID 0 resolved via `pg_get_userbyid(0)`).

### SQL safety verification

Before publication, the script was statically reviewed to confirm:

- ✅ Only SELECT statements and read-only metadata queries
- ✅ No INSERT, UPDATE, DELETE, TRUNCATE, ALTER, DROP, CREATE, GRANT, or REVOKE
- ✅ No calls to functions that modify data
- ✅ No execution of `public.is_admin(uuid)` with any arguments
- ✅ No reads of actual profile rows or personal data
- ✅ No secrets, credentials, or connection strings
- ✅ Compatible with Supabase SQL Editor (static review only; not actually executed)
- ✅ Missing optional objects or roles do not prevent unrelated sections from being run separately; however, any individual query that references a missing object or role will fail on its own

**Classification:** This is a **static review** only. The SQL has not been executed against PostgreSQL, and no live test environment was used to validate execution.

---

## 8. Clear instructions for the user

### Android-friendly procedure for running the verification SQL

1. **Open the official Supabase Dashboard** in your mobile browser or tablet browser.
2. **Select the Scholars production project.** Confirm its project identity before proceeding. If you cannot confidently identify the correct Scholars project, stop and ask for confirmation before running anything.
3. **Open SQL Editor** from the left-hand navigation.
4. **Create a new query.**
5. **Paste the read-only SQL script** from the file `reports/scholars/sql/2026-11-15-resource-center-read-only-security-verification.sql` (published to ImperioKDB/Updates at commit `5f4af4f2c96141a8a920288046952c3f6e189a67`).
6. **Review the script** to confirm it contains only SELECT statements (no mutation statements).
7. **Execute the query.**
8. **Export or copy the result tables** without including credentials or personal records.
9. **Return the results** for independent interpretation.

### What to look for in the results

| Expected result if vulnerability exists | Interpretation |
|----------------------------------------|----------------|
| `has_schema_privilege('authenticated', 'public', 'USAGE')` = `true` | `authenticated` can access schema `public` (prerequisite for table access) |
| `has_table_privilege('authenticated', 'public.profiles', 'UPDATE')` = `true` | `authenticated` has table-level UPDATE on profiles |
| `has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')` = `true` | `authenticated` can UPDATE `is_admin` at column level |
| `has_table_privilege('authenticated', 'public.profiles', 'UPDATE')` = `true` AND column-level = `false` | Table-level grant exists but column-level revoke applied — **table-level grant still permits UPDATE on is_admin** (this is the vulnerability) |
| `relrowsecurity` = `true` AND `relforcerowsecurity` = `false` | RLS enabled but not forced (table owner can bypass) |
| Policy `profiles_update_own` with `USING (auth.uid() = id)` | Own-row policy permits self-update |
| `has_function_privilege('public', 'public.is_admin(uuid)', 'EXECUTE')` = `true` | Arbitrary-UUID oracle is callable by PUBLIC |

### What NOT to do

- Do NOT modify the script before running.
- Do NOT add any INSERT, UPDATE, DELETE, or other mutation statements.
- Do NOT call `public.is_admin(uuid)` with any user ID.
- Do NOT share your project URL, database password, service-role key, or access token.
- Do NOT run this against any project other than the confirmed Scholars production project.

---

## 9. Remaining unknowns

| # | Unknown | Classification | Reason |
|---|---------|----------------|--------|
| 1 | Does `authenticated` have effective table-level UPDATE on `public.profiles` in the live database? | UNVERIFIED — DATABASE | No catalog access available |
| 2 | Does `authenticated` have effective column-level UPDATE on `profiles.is_admin` in the live database? | UNVERIFIED — DATABASE | No catalog access available |
| 3 | Is RLS enforced (forced) on `public.profiles` in the live database? | UNVERIFIED — DATABASE | No catalog access available |
| 4 | What are the exact RLS policy expressions on `public.profiles` in the live database? | UNVERIFIED — DATABASE | No catalog access available |
| 5 | Is `public.is_admin(uuid)` executable by PUBLIC/anon/authenticated in the live database? | UNVERIFIED — DATABASE | No catalog access available |
| 6 | What is the function owner, SECURITY DEFINER status, and search_path of `is_admin(uuid)` in the live database? | UNVERIFIED — DATABASE | No catalog access available |

---

## 10. What can and cannot be concluded before live results

### Can be concluded (VERIFIED — SOURCE)

1. Migration `0029` grants table-level INSERT/UPDATE on `public.profiles` to `authenticated`.
2. Migration `0029` column-level revokes INSERT/UPDATE on `is_admin` — this cannot cancel the table-level grant under PostgreSQL semantics.
3. Migration `0023` creates an own-row RLS policy permitting self-update of profiles.
4. No migration after `0029` revokes the table-level grant.
5. The privilege regression is documented in the migration source and is **not dependent on grant order**.
6. If the grant is effective in the live database, an ordinary authenticated user can structurally self-elevate `is_admin`.

### Cannot be concluded (UNVERIFIED — DATABASE)

1. Whether the table-level grant from `0029` is actually effective in the live production database.
2. Whether the live database matches the migration source (migrations may not have been applied, or later manual grants/revokes may exist).
3. Whether RLS is enforced and whether the own-row policy is active.
4. Whether `is_admin(uuid)` is callable by PUBLIC/anon/authenticated in the live database.

### Required before any remediation

Execute the read-only verification SQL against the live production database and confirm:
- `has_table_privilege('authenticated', 'public.profiles', 'UPDATE')` result
- `has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')` result
- RLS status and FORCE RLS status
- RLS policy expressions
- Function EXECUTE privileges

Only after these live results are available can the vulnerability be classified as VERIFIED — DATABASE and remediation be authorized.

---

## 11. Report publication

**Report file:** `reports/scholars/2026-11-15-resource-center-phase-2b-privilege-regression-correction.md`  
**SQL file:** `reports/scholars/sql/2026-11-15-resource-center-read-only-security-verification.sql`  
**SQL publication commit SHA:** `5f4af4f2c96141a8a920288046952c3f6e189a67`  
**Target repository:** `ImperioKDB/Updates`  
**Publication method:** GitHub Contents API  
**Status:** Published. Both files have been published and verified back from GitHub.

**Publication status summary:**

- **SQL file has been published.** Commit `5f4af4f2c96141a8a920288046952c3f6e189a67`.
- **SQL has NOT been executed.** No live database verification has occurred.
- **Report has been published.** Commit `5ca4aad3a021feb6636dc80174e48280cb06ba3c` (this commit contains the final metadata synchronisation; the report was previously published at an earlier revision).
- **Static review only.** The SQL received static inspection only; no actual PostgreSQL execution testing was performed.

This report is read-only. No implementation, remediation, migration, database access attempt, or deployment was performed. Await the user's execution of the read-only SQL and return of results before any remediation is authorized.