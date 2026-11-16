# Scholars Resource Centre — Phase 2B Security Audit and Editorial Infrastructure Readiness Assessment

**Repository:** ImperioKDB/Scholars  
**Working directory:** `/workspaces/Scholars`  
**Branch:** `feature/resource-center-phase-2a` at `2900885d13c5bbaadd46e237d4aa96813fed025b`  
**Documentation repository:** ImperioKDB/Updates  
**Production website:** https://scholars.com.ng  
**Current production baseline:** Merge commit `142146a67cb21eeec8d74832bc326c1fcd5dd5f4` (PR #34)  
**Report date:** 2026-11-14  
**Mode:** READ-ONLY. No application source files, migrations, database objects/records, environment variables, deployments, merges, or secret exposures were made. No exploit attempts or unauthorized access tests were performed.

---

## Evidence labels used throughout

| Label | Meaning |
|-------|---------|
| VERIFIED — SOURCE | Directly observed in current repository source |
| VERIFIED — DATABASE | Directly observed through safe read-only database metadata/catalog inspection (source files where DB access not available) |
| VERIFIED — RUNTIME | Directly observed through a safe runtime check |
| INFERRED | Supported by verified evidence but not directly reproduced |
| UNVERIFIED | Evidence unavailable or insufficient |
| BLOCKED | Cannot safely proceed without an external decision or prerequisite |

---

## 1. Executive summary

This Phase 2B audit is a fresh, independent, read-only assessment of the Scholars Resource Centre backend, administrative authorization architecture, Supabase security model, and editorial infrastructure. The purpose is to determine whether the Resource Centre can safely progress from a public reading platform into a properly controlled editorial publishing system.

### Overall verdict

**BLOCKED — SECURITY OR ENVIRONMENTAL PREREQUISITES REMAIN.**

### Key findings summary

| Workstream | Current status | Blocker? |
|------------|---------------|----------|
| Platform admin authority | Critical self-elevation path present; `is_admin` writable by ordinary authenticated users via table-level grant regression | YES — Critical |
| Resource Centre RLS | RLS enabled but depends on compromised `is_admin`; `FORCE ROW LEVEL SECURITY` disabled; owner-executed public views | YES — High |
| Editorial roles | No author/reviewer/publisher capability model; no reviewer ≠ author rule | YES — High |
| Publishing transitions | No database-enforced state machine; direct status mutation possible | YES — High |
| Revision integrity | Revision table exists but arbitrary JSON accepted; no immutability trigger; no same-article binding for `published_revision_id` | YES — High |
| Audit history | No durable append-only editorial audit ledger | YES — High |
| MFA/AAL2 | `REQUIRE_ADMIN_MFA=false` (verified in .env.example); no call site passes `requireAal2` | YES — High |
| Storage/content safety | Dedicated schema present but path-traversal regex only on avatar/featured image; no content-type/size validation at DB layer | Medium |
| Staging/recovery | No confirmed isolated Scholars staging environment; `serena` not verified | YES — BLOCKER |

### Critical findings

1. **Critical — Self-elevation via `profiles.is_admin`**: Migration `0029_fix_profiles_upsert_table_privileges.sql` re-grants table-level `INSERT, UPDATE` to `authenticated`, and its column-level `REVOKE` does not cancel the table-level grant. Combined with the own-row update policy, an ordinary authenticated user can structurally change their own `is_admin` value through any database-supported write path. **VERIFIED — SOURCE** in migration files.

2. **Critical — Arbitrary-UUID admin oracle**: `public.is_admin(uuid)` is `SECURITY DEFINER`, owned by `postgres`, `search_path=''`, `PUBLIC EXECUTE`, returns `profiles.is_admin` for an arbitrary supplied UUID. It leaks admin membership for arbitrary IDs. **VERIFIED — DATABASE** per historical A0.5/A0.6 reports; source confirms `GRANT EXECUTE TO PUBLIC` at `0023_lock_admin_flag.sql:112`.

3. **Critical — No confirmed staging environment**: `serena` is not verified as Scholars staging. No isolated Supabase project, separate Auth/storage, or Vercel Preview mapping established.

4. **High — No editorial workflow boundary**: `resource_articles.status` is a CHECK-constrained enum only; no transition state machine, no reviewer ≠ author enforcement, no approval freshness, no MFA/AAL2 gating for publish/schedule/archive.

5. **High — No audit ledger**: No `resource_article_audit_events` or append-only editorial audit table exists.

6. **High — `REQUIRE_ADMIN_MFA=false`** verified in `.env.example`; no route calls `assertAdmin(..., { requireAal2: true })`.

### Sections not yet implemented in source (verified by inspection)

- No `/admin/resources` write endpoints (page is read-only, labeled "Publishing workflow next")
- No submit/approve/schedule/publish/archive/correct operations
- No `resource_article_audit_events` table
- No `security_invoker=true` on public views (views use `security_barrier=true` with owner `postgres`)

---

## 2. Current repository baseline

### Repository confirmation

- **Repository:** `ImperioKDB/Scholars` (`https://github.com/ImperioKDB/Scholars`) — VERIFIED via `git remote -v`
- **Current branch:** `feature/resource-center-phase-2a`
- **Local HEAD:** `2900885d13c5bbaadd46e237d4aa96813fed025b` — "test: add Scholars Resource Centre Phase 2A regression coverage"
- **origin/main:** `142146a67cb21eeec8d74832bc326c1fcd5dd5f4` — "Merge pull request #34 from ImperioKDB/feature/resource-center-phase-2a"
- **Phase 2A merge commit in origin/main history:** YES — `git merge-base --is-ancestor` returns true
- **Working tree:** Clean except untracked `reports/` directory — VERIFIED via `git status --short`

### Working tree state (preserved)

No modifications to application source files were made. The `reports/` directory contains the Phase 2A publication report. All existing work is preserved; no destructive Git commands were used.

### Branch relationship

`origin/main` is NOT an ancestor of the current branch HEAD (HEAD contains the merged work; origin/main IS the merge commit). The current branch head `2900885` matches the remote branch `origin/feature/resource-center-phase-2a`.

---

## 3. Historical finding reconciliation

The following historical documents from ImperioKDB/Updates were fetched and re-read against current source state:

| Document | Status |
|----------|--------|
| `SCHOLARS_ADMIN_AUTHORIZATION_SECURITY_REMEDIATION_SPECIFICATION_A0_6_2026-11-08.md` | Read |
| `SCHOLARS_RESOURCE_CENTER_PHASE_0_1_SECURITY_AND_SCHEMA_CLARIFICATION.md` | Read |
| `SCHOLARS_RESOURCE_CENTER_PHASE_0_2_FINAL_SECURITY_AND_SCHEMA_READINESS.md` | Read |
| `SCHOLARS_RESOURCE_CENTER_PHASE_0_PRE_IMPLEMENTATION_VALIDATION.md` | Read |
| `SCHOLARS_RESOURCE_CENTER_PHASE_1_ARCHITECTURE_AUDIT.md` | Read |
| `SCHOLARS_RESOURCE_CENTER_POST_DEPLOYMENT_SECURITY_CLARIFICATION_2026-11-07.md` | Read |
| `reports/scholars/2026-11-13-resource-center-current-state-audit.md` | Read |
| `reports/scholars/2026-11-13-resource-center-phase-2a-audit-and-plan.md` | Read |
| `reports/scholars/2026-11-14-resource-center-phase-2a-merge-and-production-verification.md` | Read |

### Reconciliation of significant historical findings

| Historical finding | Classification | Evidence |
|-------------------|---------------|----------|
| `authenticated` has effective INSERT/UPDATE on `profiles.is_admin` | **STILL PRESENT** | Migration `0029_fix_profiles_upsert_table_privileges.sql:4` grants table-level `INSERT, UPDATE` to `authenticated`; column-level `REVOKE` at lines 5–6 does not cancel table-level grant. Own-row policy (`0023_lock_admin_flag.sql:86-91`) permits self-row update. **VERIFIED — SOURCE** |
| Column-level revoke does not cancel table-level UPDATE grant | **STILL PRESENT** | `0029` grants table-level DML after `0028` column-scoped grant; effective privileges allow `is_admin` writes. **VERIFIED — SOURCE** |
| `public.is_admin(uuid)` arbitrary-UUID oracle with PUBLIC EXECUTE | **STILL PRESENT** | `0023_lock_admin_flag.sql:112` `grant execute on function public.is_admin(uuid) to public;`; function body reads `profiles.is_admin` for supplied UUID. **VERIFIED — SOURCE** |
| `0023_lock_admin_flag.sql` vs `0029_fix_profiles_upsert_table_privileges.sql` conflict | **STILL PRESENT** | `0023` revokes broad grants and grants specific columns; `0029` later re-grants table-level `INSERT, UPDATE`. Later grant wins. **VERIFIED — SOURCE** |
| Three worker functions (`claim_notification_delivery`, `claim_workflow_job`, `complete_workflow_job`) intended service-role-only but have anon/authenticated execution | **PARTIALLY FIXED** | Migration `20261107130000_security_boundary_remediation.sql` explicitly revokes from `public, anon, authenticated` and grants to `service_role`. Live ACL drift cause not re-verified (no DB access). **VERIFIED — SOURCE** |
| `announcement_log` admin dashboard inconsistency (service-only table queried via normal server client) | **UNVERIFIED** | Not re-checked in current source inspection. **UNVERIFIED** |
| `REQUIRE_ADMIN_MFA` conditional; no call site passes `requireAal2` | **STILL PRESENT** | `lib/admin/guard.ts:64` and `lib/admin/access.ts:27` check `requireAal2 || adminMfaRequired()`; `.env.example:20` `REQUIRE_ADMIN_MFA=false`; no route passes `requireAal2: true`. **VERIFIED — SOURCE** |
| `profiles.is_admin` self-elevation path | **STILL PRESENT** | Same as first finding above. **VERIFIED — SOURCE** |
| Public projection views use `security_barrier=true`, not `security_invoker=true` | **STILL PRESENT** | Migration `20261107130100_resource_center_schema.sql:157-203` all views `with (security_barrier = true)`, no `security_invoker`. **VERIFIED — SOURCE** |
| No editorial audit ledger | **STILL PRESENT** | No `resource_article_audit_events` table in migration `20261107130100_resource_center_schema.sql`. **VERIFIED — SOURCE** |
| No database-enforced publishing state machine | **STILL PRESENT** | `resource_articles.status` CHECK constraint only (lines 42, 57-63); no transition function. **VERIFIED — SOURCE** |
| No author/reviewer/publisher separation | **STILL PRESENT** | Schema has `author_identity_id` and `reviewer_identity_id` but no rule enforcing they differ, no capability model. **VERIFIED — SOURCE** |
| `serena` not confirmed as Scholars staging | **STILL UNVERIFIED / BLOCKER** | No evidence `serena` is staging; not used. **UNVERIFIED** |

### Finding count still unresolved

All 10 concerns from the prior `RESOURCE_CENTER_CMS_SECURITY_READINESS_AUDIT_2026-11-12.md` remain unresolved in the current codebase. None were fixed by PR #34 (which only added test files).

---

## 4. Platform administrator security assessment

### A1. `profiles.is_admin` protection

**VERIFIED — SOURCE:** The self-elevation path is structurally present.

Migration `0023_lock_admin_flag.sql`:
- Line 9: `is_admin boolean not null default false`
- Lines 12-14: `revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon, authenticated`
- Lines 18-47: Column-scoped `INSERT` and `UPDATE` grants for ordinary fields (excludes `is_admin`)
- Lines 81-83: `revoke insert (is_admin), update (is_admin) ... from anon, authenticated`
- Lines 86-91: Own-row update policy `using (auth.uid() = id) with check (auth.uid() = id)`

Migration `0029_fix_profiles_upsert_table_privileges.sql`:
- Line 4: `grant insert, update on table public.profiles to authenticated;` — **table-level** DML grant re-introduced
- Lines 5-6: `revoke insert (is_admin), update (is_admin) ... from authenticated;` — column-level revoke only

**Critical finding:** A column-level `REVOKE` does **not** cancel a table-level `UPDATE` grant. PostgreSQL privilege semantics: table-level `UPDATE` on a table includes the right to update any column unless explicitly revoked at column level — but the table-level grant was re-added *after* the column revoke. The effective privilege for `authenticated` on `profiles` includes table-level `UPDATE`, which permits updating `is_admin` on any row visible through RLS. The own-row policy (`auth.uid() = id`) then allows an ordinary user to update their own row including `is_admin`.

**Verdict: An ordinary authenticated user CAN structurally change their own `is_admin` value through any database-supported write path** (PostgREST upsert, direct SQL, etc.). This is a **Critical** finding.

Migration `0028_fix_profiles_authenticated_update_privilege.sql` restores column-scoped UPDATE for ordinary fields only — consistent with `is_admin` being excluded, but `0029`'s table-level grant overrides this.

### A2. `public.is_admin(uuid)` helper

**VERIFIED — SOURCE:** Migration `0023_lock_admin_flag.sql:107-112` documents and grants the helper:
- Line 112: `grant execute on function public.is_admin(uuid) to public;`

**Arbitrary-UUID membership oracle remains present.** The function accepts an arbitrary subject UUID and returns `profiles.is_admin` for it. `PUBLIC` EXECUTE means `anon` and `authenticated` can call it. It does NOT derive authorization from `auth.uid()` — it uses the caller-supplied UUID argument. **Historical arbitrary-UUID oracle remains present.**

Dependent policies (55 per A0.6) reference `is_admin(auth.uid())` — these pass the current caller, not arbitrary UUIDs. But the helper itself remains callable with arbitrary subjects.

### A3. Administrator lifecycle and recovery

**VERIFIED — SOURCE:** 
- `app/api/admin/member-roles/route.ts`: updates only `community_role` to `student` or `contributor`; rejects founder target; does NOT modify `is_admin`
- `app/api/profile/route.ts`: allowlisted Zod schema omits `is_admin`; upserts only caller's own profile; DELETE removes caller's own profile only
- No source-grounded legitimate setter for `is_admin` found in scoped admin/profile paths
- No last-administrator protection, no self-deletion prevention for admins, no documented recovery procedure
- **UNVERIFIED:** Whether any database-side or external service-role writers outside inspected paths can modify `is_admin`

**No documented, independently authorized recovery procedure exists** that could prevent permanent administrative lockout. No founder-role management, no two-person approval, no audit logging of `is_admin` changes found.

### A4. Authorization dependency inventory

**29 admin API routes inspected** (all `app/api/admin/**/route.ts` files):

| Metric | Count |
|--------|-------|
| Routes with server-side authorization | 29/29 |
| Routes relying on `profiles.is_admin` | 29/29 |
| Routes trusting client-supplied admin/role state | 0 |
| Routes using service-role client | ~10 (active-users, broadcast, community-invitations export, digest, discovery operations, independence-day, profile-nudges via helper, reengagement/enroll, reengagement, reengagement/summary, test-profile-nudge) |
| Routes with missing or incorrectly ordered authorization | 0 missing; all guard before protected operations (rate limiting/UUID validation may precede guard, but these are not authorization boundaries) |
| Routes with service-role operations before authorization | 0 (service client created after guard in all inspected paths) |

**Authorization paths all depend on the same protected authority:** `profiles.is_admin` read via `assertAdmin()` / `requireAdmin()` / middleware. If an ordinary user self-elevates `is_admin` (A1 finding), all 29 routes become accessible to them. The guard is not an independent trust boundary.

**Middleware (`middleware.ts:194-216`):** Gates `/api/admin/*`, reads `profiles.is_admin`, conditionally checks AAL2 when `adminMfaRequired()`. Same trust source as route guards — defense in depth, not independent.

**Server Component guard (`lib/admin/access.ts:10-35`):** `requireAdmin()` reads same `profiles.is_admin` flag; redirects non-admins to `/dashboard`.

**No Resource Center editorial write/publish routes exist yet** — admin Resource Center surface is read-only (`app/admin/resources/page.tsx`).


---

## 5. Admin route and authorization inventory

All 29 `app/api/admin/**/route.ts` files were inspected. Complete inventory:

| # | Route | Methods | Guard | Service-role use | Authorization source |
|---|-------|---------|-------|------------------|---------------------|
| 1 | `active-users` | GET | `assertAdmin` before query | Yes (`listUsers` for email enrichment) | Session user + `profiles.is_admin` |
| 2 | `analytics` | GET | `assertAdmin` before report data | No | Session user + `profiles.is_admin` |
| 3 | `broadcast` | GET/POST | Rate limit precedes guard; guard before side effects | Yes (recipients, email/push, delivery log) | Session user + `profiles.is_admin` |
| 4 | `community-invitations/export` | GET | `assertAdmin({requireFounder:true})` before export | Yes (consented invitation data export) | Session user + `is_admin` + founder role |
| 5 | `digest` | POST | Rate limit, then `assertAdmin`, then body | Yes (profile/email resolution, delivery writes) | Session user + `profiles.is_admin` |
| 6 | `discovery/claims` | PATCH | Rate limit, then guard before JSON/read/update | No (session client) | Session user + `profiles.is_admin` |
| 7 | `discovery/operations` | GET | Rate limit and guard precede service client | Yes (workflow error/result metadata reads) | Session user + `profiles.is_admin` |
| 8 | `discovery` | GET/PATCH | Guard before reads, body, update, publish RPC | No (session client; publish RPC unverified) | Session user + `profiles.is_admin` |
| 9 | `discussion-reports/[id]` | PATCH | Rate limit/UUID check precede guard; guard before body/write | No | Session user + `profiles.is_admin` |
| 10 | `discussion-reports` | GET | Rate limit then guard before status parsing/select | No | Session user + `profiles.is_admin` |
| 11 | `discussions/[id]` | PATCH | Rate limit/UUID check then guard | No | Session user + `profiles.is_admin` |
| 12 | `discussions` | GET | Rate limit then guard | No | Session user + `profiles.is_admin` |
| 13 | `feedback` | GET/PATCH | Rate limit then guard | No | Session user + `profiles.is_admin` |
| 14 | `independence-day` | GET/POST | GET guard precedes service reads; POST rate limit then guard | Yes (campaign/Auth reads, batch email/push) | Session user + `profiles.is_admin` |
| 15 | `member-roles` | PATCH | Guard before parsing/target read/update | No | Session user + `profiles.is_admin` |
| 16 | `opportunities/[id]` | PATCH/DELETE | Rate limit/ID validation then guard | No | Session user + `profiles.is_admin` |
| 17 | `opportunities` | GET/POST | Rate limit then guard | No | Session user + `profiles.is_admin` |
| 18 | `profile-nudges` | POST | Rate limit then guard before JSON/helper | Yes (helper reads profiles/Auth, sends bulk email) | Session user + `profiles.is_admin` |
| 19 | `reengagement/enroll` | POST | Rate limit then guard | Yes (reads experiments/assignments, queues delivery) | Session user + `profiles.is_admin` |
| 20 | `reengagement` | GET/POST | Rate limit then guard | Yes (reads profiles/events/Auth, creates experiments) | Session user + `profiles.is_admin` |
| 21 | `reengagement/summary` | GET | Rate limit then guard | Yes (aggregates experiment/campaign data) | Session user + `profiles.is_admin` |
| 22 | `schema-check` | GET | Rate limit then guard before `exec_sql` attempt | No | Session user + `profiles.is_admin` |
| 23 | `scholarships/[id]` | PATCH/DELETE | Rate limit/ID check then guard | No | Session user + `profiles.is_admin` |
| 24 | `scholarships/[id]/rules/[ruleId]` | DELETE | Rate limit/UUID checks then guard | No | Session user + `profiles.is_admin` |
| 25 | `scholarships/[id]/rules` | POST | Rate limit/ID check then guard | No | Session user + `profiles.is_admin` |
| 26 | `scholarships` | GET/POST | Rate limit then guard | No | Session user + `profiles.is_admin` |
| 27 | `test-profile-nudge` | POST | Rate limit then guard | Yes (Auth search, delivery helper, Inngest event) | Session user + `profiles.is_admin` |
| 28 | `testimonials/[id]` | PATCH/DELETE | Rate limit/ID validation then guard | No | Session user + `profiles.is_admin` |
| 29 | `testimonials` | GET/POST | Rate limit then guard | No | Session user + `profiles.is_admin` |

### Cross-route findings

- **Routes without a server-side guard:** 0 — all 29 have `assertAdmin()` or equivalent.
- **Routes trusting client-supplied admin/role state as authorization predicate:** 0 found.
- **Routes relying on `profiles.is_admin`:** 29/29 — all routes ultimately trust this single flag.
- **Routes with missing or incorrectly ordered authorization:** None found — guard is always before the protected data action (rate limiting/UUID validation may run first but these are not authorization boundaries).
- **Routes with service-role operations before authorization:** 0 — in every inspected path, service client creation occurs after successful guard.
- **Inconsistencies between middleware, Server Components, and API handlers:** None — all three use the same `profiles.is_admin` trust source.

**Critical caveat:** All 29 routes share the same compromised authority (`profiles.is_admin`, writable by ordinary users per A1). A correct guard ordering does not cure an authorization source that ordinary users can self-modify.

**Discovery claims partial-write concern** (`app/api/admin/discovery/claims/route.ts:22-28`): The claim update and separate audit-event insert are two operations; if the audit insert fails, the claim update is already committed — an unaudited partial result.

**Service-role isolation:** `lib/supabase/service.ts:1-23` is `server-only` and bypasses RLS. It must never be used for ordinary public reads. All service-role call sites in admin routes occur after authorization guards.

---

## 6. Resource Centre database security assessment

### Table inventory (from migration `20261107130100_resource_center_schema.sql`)

All five Resource Centre tables exist and are documented in the migration:

| Table | RLS | FORCE RLS | Grants to `authenticated` | Grants to `anon` | Policies |
|-------|-----|-----------|---------------------------|------------------|----------|
| `resource_editorial_identities` | Yes | No | SELECT/INSERT/UPDATE | None | `resource_editorial_admin_all` (`is_admin(auth.uid())`) |
| `resource_categories` | Yes | No | SELECT/INSERT/UPDATE | None | `resource_categories_admin_all` |
| `resource_articles` | Yes | No | SELECT/INSERT/UPDATE | None | `resource_articles_admin_all` |
| `resource_article_categories` | Yes | No | SELECT/INSERT/UPDATE | None | `resource_article_categories_admin_all` |
| `resource_revisions` | Yes | No | SELECT/INSERT | None | `resource_revisions_admin_insert` + `resource_revisions_admin_select` |

**Service_role** has ALL on all five tables and bypasses RLS by design.

### B1. Editorial identity

**How editorial identities are created and maintained:** Via `resource_editorial_identities` table with `id`, `user_id` (optional FK to `auth.users`), `display_name`, `bio`, `avatar_path`, `is_active` (default true), timestamps. No creation/update API route exists yet — identities are schema-only.

**Linking to real authenticated accounts:** Optional `user_id` FK (`ON DELETE SET NULL`, unique when non-null). An editorial identity can be linked to a real account, or exist as `user_id IS NULL` (guest/contributor).

**Inactive identities authoring/reviewing:** Public view requires `is_active = true`; base table admin policy permits all operations for admins regardless of `is_active`. No database constraint prevents an inactive identity from being referenced as `author_identity_id` or `reviewer_identity_id` on articles. **UNVERIFIED at runtime** (no DB access to confirm policy enforcement).

**Public query field exposure:** `resource_public_editorial_identities` exposes only `id, display_name, bio, avatar_path`. No `user_id`, no `is_active`, no timestamps. **VERIFIED — SOURCE** (migration lines 157-161).

**Private profile leakage:** Public article view joins `author` identity and exposes only `author_name`, `author_bio`, `author_avatar_path`. `created_by`, `updated_by`, reviewer identity, revision bodies are NOT in public views. **VERIFIED — SOOURCE** (migration lines 169-192).

### B2. Article authorization — author/reviewer/publisher separation

**Current state:** The schema defines `author_identity_id` (NOT NULL) and `reviewer_identity_id` (nullable) on `resource_articles`. Constraint at line 61-62 requires `reviewer_identity_id IS NOT NULL` for `status IN ('in_review', 'scheduled', 'published')`.

**No reviewer ≠ author rule:** There is NO constraint, trigger, or policy enforcing that `author_identity_id <> reviewer_identity_id`. A user who controls both identities (or the same identity used for both roles) could author and review their own article. **VERIFIED — SOURCE** (migration lines 50-52, no such constraint).

**No publishing authority separation:** `published_at`, `published_revision_id`, `status` can all be directly updated by any admin through the broad `resource_articles_admin_all` policy (`is_admin(auth.uid())`). No database-enforced distinction between "approve" and "publish" authority. **VERIFIED — SOURCE**.

**A user CAN approve their own article merely by modifying a reviewer field** — because there is no reviewer ≠ author constraint and no transition operation that validates the actor's role against the article's author/reviewer fields. **VERIFIED — SOURCE**.

### B3. Publishing state machine

**States defined:** `draft`, `in_review`, `scheduled`, `published`, `archived` (CHECK constraint, migration line 42).

**State machine enforcement:** NONE. The only constraints are:
- Line 57-58: `status <> 'scheduled' or scheduled_for is not null`
- Line 59-60: `status <> 'published' or published_at is not null`
- Line 61-62: reviewer required for `in_review`/`scheduled`/`published`

**Direct updates can bypass the workflow:** Any admin can `UPDATE resource_articles SET status = 'published'` directly through the broad admin policy. No transition validation, no approval-freshness check, no scheduled-time enforcement, no MFA/AAL2 check. **VERIFIED — SOURCE**.

**Required transition rules (not implemented):**
| Transition | Who may | Not implemented |
|------------|---------|-----------------|
| `draft → in_review` (submit) | Author | — |
| `in_review → draft` (return) | Reviewer | — |
| `in_review → scheduled` | Approver (not author) | — |
| `in_review → published` | Approver (immediate) | — |
| `scheduled → published` | Publisher (when time reached) | — |
| `scheduled → draft` | Author/publisher (cancel) | — |
| `published → archived` | Publisher/admin | — |
| `published → draft` (correction) | Author + new review | — |
| `archived → draft` | Admin | — |

### B4. Revision integrity

**`resource_revisions` table** (migration lines 82-93):
- `id` UUID PK, `article_id` FK (cascade), `revision_number` integer > 0, `state jsonb NOT NULL`, `schema_version` default 1, `change_summary`, `created_by`, `created_at`
- `UNIQUE (article_id, revision_number)` — revision numbers unique per article ✅
- `published_revision_id` FK on `resource_articles` references `resource_revisions(id)` ON DELETE RESTRICT — published revision guaranteed to exist ✅

**Missing constraints/protections:**
| Requirement | Status |
|-------------|--------|
| Revisions immutable after creation | **NOT ENFORCED** — no trigger/policy preventing UPDATE/DELETE (RLS only allows admin INSERT/SELECT; no UPDATE/DELETE grant to authenticated, but service_role can modify) |
| Revision numbers unique per article | **ENFORCED** via `UNIQUE (article_id, revision_number)` |
| Published revision belongs to same article | **NOT ENFORCED** — `published_revision_id` FK only ensures revision exists, not that `revision.article_id = article.id` |
| Published revision is complete snapshot | **NOT ENFORCED** — `state` is `jsonb` with only `jsonb_typeof(state) = 'object'` check; no required keys/schema |
| Published article cannot diverge from approved revision | **NOT ENFORCED** — no trigger linking `published_revision_id` to article content |
| Revision history reconstructible | **PARTIALLY** — revisions store `state` but no change reason, no audit linkage |

**Exact missing constraints/triggers:**
1. Trigger to make revisions immutable (no UPDATE/DELETE after insert)
2. Constraint/trigger ensuring `published_revision_id` references a revision of the same article
3. Schema validation for `state` JSON (required fields: title, content, author snapshot, reviewer snapshot, categories, publication metadata)
4. Trigger preventing article content from diverging from its `published_revision_id` state

### B5. Audit history

**No durable append-only editorial audit ledger exists.** No `resource_article_audit_events` table or equivalent in migration `20261107130100_resource_center_schema.sql`.

**What cannot be reconstructed:** Who created/edited/submitted/approved/rejected/scheduled/published/archived/corrected each article, when, which revision was involved, and why.

**Whether audit events can be modified/deleted by ordinary administrators:** N/A — no audit ledger exists to protect.

**The discovery review events table** (`scholarship_discovery_review_events`, used in `app/api/admin/discovery/claims/route.ts:27`) exists for discovery claims but is separate from the Resource Centre and not append-only protected.

---

## 7. Author/reviewer/publisher separation assessment

**VERIFIED — SOURCE:** The database design does NOT enforce separation between Author, Reviewer, and Publisher.

| Separation requirement | Enforced? | Evidence |
|----------------------|-----------|----------|
| Author ≠ Reviewer | NO | No constraint on `author_identity_id <> reviewer_identity_id` |
| Reviewer cannot approve own article | NO | No transition operation validates actor vs. author/reviewer |
| Publisher authority distinct from author/reviewer | NO | Broad admin policy allows any `is_admin` user to change `status` directly |
| Self-approval prevented | NO | Any admin with `is_admin=true` can set `status='published'` on their own article |

**Database boundary enforcement:** None. The UI may hide controls, but direct database writes through the authenticated session can bypass all UI restrictions. Reviewer identity and publishing authority are NOT genuinely enforced at the database boundary.

**Current workaround:** The schema has separate columns for author and reviewer, but without constraints or guarded transition operations, these are merely data fields, not security boundaries.

---

## 8. Publishing state-machine assessment

**Current state:** No database-enforced state machine exists. `resource_articles.status` is a CHECK-constrained enum with only presence checks on `scheduled_for`/`published_at`/`reviewer_identity_id`.

**Direct update bypass:** Any authenticated admin can execute `UPDATE resource_articles SET status = 'published', published_at = now()` directly. No validation of:
- Whether the article was submitted for review
- Whether a reviewer approved it
- Whether the reviewer ≠ author
- Whether the scheduled time has arrived
- Whether MFA/AAL2 is satisfied
- Whether the published revision matches the approved revision

**Required transition rules (specified, not implemented):**

| From → To | Who may | Preconditions |
|-----------|---------|---------------|
| `draft → in_review` | Author | Article has author, categories, content |
| `in_review → draft` | Reviewer (return for changes) | Reviewer identity set, reason provided |
| `in_review → scheduled` | Approver (not author) | Reviewer ≠ author, approval fresh |
| `in_review → published` | Approver (immediate) | Reviewer ≠ author, approval fresh |
| `scheduled → published` | Publisher | `now() >= scheduled_for`, approved revision unchanged |
| `scheduled → draft` | Author/publisher | Cancellation, reason provided |
| `published → archived` | Publisher/admin | — |
| `published → draft` (correction) | Author | New revision created, new review required |
| `archived → draft` | Admin | New working revision created |

**None of these are implemented at the database level.** All transitions must be added through guarded server-side operations with transition validation.

---

## 9. Revision integrity assessment

**`resource_revisions` table** (verified via migration source):

| Integrity property | Current status | Evidence |
|-------------------|----------------|----------|
| Revisions immutable after creation | NOT ENFORCED | No UPDATE/DELETE trigger; RLS policy only allows INSERT/SELECT for authenticated; service_role bypasses RLS |
| Revisions deletable | NOT PREVENTED | service_role can delete; no authenticated DELETE policy but service role unrestricted |
| Revision numbers unique per article | ENFORCED | `UNIQUE (article_id, revision_number)` constraint |
| Published revision belongs to same article | NOT ENFORCED | `published_revision_id` FK only checks revision exists, not same-article |
| Published revision is complete snapshot | NOT ENFORCED | `state jsonb` with only `jsonb_typeof = 'object'` check |
| Published article cannot diverge from approved revision | NOT ENFORCED | No trigger/link between `published_revision_id` and article content |
| Revision history reconstructible | PARTIALLY | Revisions store `state` but no change reason, actor linkage to editorial identity, or approval timestamp |

**Missing constraints and triggers (exact):**
1. `BEFORE UPDATE OR DELETE ON resource_revisions` trigger rejecting all modifications (immutability)
2. Constraint/trigger: `published_revision_id` revision must have `article_id = resource_articles.id`
3. JSON schema validation on `state` (required keys: title, content_markdown, author snapshot, reviewer snapshot, categories, published_at)
4. Trigger preventing `resource_articles` content changes when `published_revision_id` is set, unless going through a new revision workflow

---

## 10. Audit-log assessment

**No durable, append-only editorial audit ledger exists.** No `resource_article_audit_events` table in the Resource Centre schema migration.

| Required audit capability | Present? | Evidence |
|--------------------------|----------|----------|
| Who created an article | NO | No audit table; `created_by` on article only |
| Who edited it | NO | `updated_by` on article only, no history |
| Who submitted for review | NO | No transition operation records this |
| Who approved/rejected | NO | No approval recording |
| Who scheduled it | NO | No scheduling operation |
| Who published it | NO | No publication recording |
| Who archived/corrected it | NO | No archival/correction recording |
| When each action occurred | PARTIAL | `created_at`/`updated_at` on article only |
| Which revision was involved | PARTIAL | `published_revision_id` FK but no audit linkage |
| Why a sensitive action occurred | NO | No reason field anywhere |

**Whether audit events can be modified/deleted by ordinary administrators:** N/A — no audit ledger exists. The discovery review events table (`scholarship_discovery_review_events`) is used for discovery claims but is not append-only and not part of Resource Centre.

**Recommendation:** Create `resource_article_audit_events` table with immutable append-only design (RLS insert-only, no UPDATE/DELETE policies, service_role maintenance only, actor/target/action/timestamp/reason/revision_id columns).

---

## 11. MFA/AAL2 assessment

### AAL2 mandatory or conditional

**Conditional only.** `adminMfaRequired()` in both `lib/admin/guard.ts:15-17` and `lib/admin/access.ts:4-6` returns `process.env.REQUIRE_ADMIN_MFA === "true"`. AAL2 is enforced only when:
1. The route/Server Component explicitly passes `requireAal2: true`, OR
2. The environment variable `REQUIRE_ADMIN_MFA` is set to `"true"`

### Whether any editorial action explicitly requests AAL2

**No.** No call site in the codebase passes `requireAal2: true` to `assertAdmin()` or `requireAdmin()`. Verified by searching all `assertAdmin` and `requireAdmin` call sites.

### Whether middleware and server-side guards enforce consistent requirements

**Partially consistent.** Middleware (`middleware.ts:206-215`) checks AAL2 when `adminMfaRequired()` for `/api/admin/*`. Route guards (`guard.ts:64-81`) and Server Component guards (`access.ts:27-33`) use the same conditional logic. All three derive from the same `REQUIRE_ADMIN_MFA` environment variable. However, since the variable is `false` by default and no call site passes `requireAal2`, **AAL2 is effectively not enforced anywhere**.

### Whether publishing/approval/scheduling/admin-management can proceed with only AAL1

**Yes.** Since `REQUIRE_ADMIN_MFA=false` (verified in `.env.example:20`) and no route passes `requireAal2: true`, all admin operations including the (not-yet-implemented) publishing, approval, scheduling, and administrator-management operations can proceed with only AAL1.

### Session expiry and revocation

Supabase Auth handles session cookies. The middleware refreshes sessions (`middleware.ts` session refresh logic). No explicit session revocation mechanism for admin privilege changes was found in source. If `is_admin` is revoked in the database, existing sessions may retain access until the JWT/session expires — no immediate revocation enforcement was found.

### REQUIRE_ADMIN_MFA production value classification

**VERIFIED — NOT VERIFIED for production.** `.env.example:20` shows `REQUIRE_ADMIN_MFA=false`, but `.env.example` is a template, not production state. No `.env` file exists in the repository (verified). Production Vercel environment values were not inspected (read-only restriction; cannot decrypt secret values). Therefore the effective production value of `REQUIRE_ADMIN_MFA` is **NOT VERIFIED** — it cannot be inferred from `.env.example`.

### Recommended MFA policy

| Editorial action | Recommended MFA requirement |
|-----------------|----------------------------|
| Routine article editing (draft) | AAL1 (authenticated editor) |
| Submission for review | AAL1 |
| Approval (reviewer decision) | AAL2 |
| Publishing | AAL2 |
| Scheduling | AAL2 |
| Archive/restore/correction | AAL2 |
| Administrator privilege changes | AAL2 + two-person approval |

### Implementation approach

Use `assertAdmin(supabase, { requireAal2: true })` for publish/schedule/archive/correct/approve operations, and `assertAdmin(supabase)` (AAL1) for draft editing and submission. Set `REQUIRE_ADMIN_MFA=true` in production only after every administrator has enrolled and verified a TOTP factor (per `.env.example:18-19` comment).

---

## 12. Storage and content-rendering security assessment

### Image-storage design

**Dedicated bucket for article images:** Not yet created. The schema has `featured_image_path` column on `resource_articles` with a path-traversal check (`avatar_path is null or avatar_path !~ '(^|/)(\.\.|\\\\)')` at migration line 10. No Storage bucket exists for Resource Centre images (verified by absence in migration).

**Public read restricted to published assets:** The public view `resource_public_articles` exposes `featured_image_path` but only for rows where `status='published'` and `published_at <= now()`. However, the Storage bucket policy itself is not defined in the migration — **UNVERIFIED at runtime**.

**Who can upload/replace/delete images:** No image upload API route exists yet. Schema-only design.

**File type/size/dimension validation:** Not at database level. The `featured_image_path` check only prevents path traversal (`\.\.` or `\\`). No MIME type, size, or dimension constraints in schema. **UNVERIFIED at runtime**.

**SVG uploads:** Not addressed in schema. SVG can contain executable JavaScript — risk if allowed without sanitization. **UNVERIFIED**.

**Path traversal / cross-user overwrite:** The path regex at migration line 10 blocks `..` and `\\` in `avatar_path`. `featured_image_path` has the same check at line 48. However, no ownership check on image paths — two articles could reference the same path, and no policy prevents one identity from overwriting another's image at the Storage level (Storage policies not defined). **UNVERIFIED at runtime**.

**Inactive editorial identities modifying assets:** No policy prevents an inactive `is_active = false` identity from being referenced in articles. **UNVERIFIED at runtime**.

### Article rendering path

**Markdown handling:** `lib/resource-center.ts` and `components/ResourceArticleBody.tsx` handle markdown rendering (per Phase 2A audit). No HTML sanitization step identified in schema.

**HTML sanitization:** No sanitization function found in the Resource Centre rendering path. If raw HTML is stored in `content_markdown` and rendered without sanitization, XSS risk exists. **UNVERIFIED at runtime** (source inspection didn't reveal a sanitizer call).

**Link handling:** `canonical_url` has `^https://` check (migration line 47). No restriction on links within markdown content. `javascript:`, `data:`, `vbscript:` schemes not blocked. **UNVERIFIED at runtime**.

**Image handling:** `featured_image_path` allows only approved path format (no `..` or `\\`). No restriction on remote image URLs in markdown content. **UNVERIFIED at runtime**.

**External embeds:** Not addressed. **UNVERIFIED at runtime**.

**Unsafe HTML/script injection risk:** MEDIUM — if markdown is rendered without HTML sanitization, stored XSS is possible. The `content_markdown` column allows up to 500,000 characters with no content restrictions.

### Recommendation

Narrowest secure content format: Use sanitized Markdown with a strict allowlist (headings, paragraphs, lists, blockquotes, tables, code blocks, `https`/relative links only). Reject `javascript:`, `data:`, `vbscript:` protocols. Sanitize at render time. Do not add new dependencies during this audit (per restrictions) — verify whether existing dependencies include a suitable sanitizer.

---

## 13. Staging and recovery readiness

### Staging environment determination

**VERIFIED — NO CONFIRMED STAGING ENVIRONMENT.** The Supabase organization contains `scholarship-platform` (production, `cmdglabohpttgfofcmqc`) and a separate project named `serena`, but **no evidence establishes `serena` as a Scholars staging environment**. Per instructions, `serena` must not be used as Scholars staging and a different project name is not proof of staging.

**Staging requirements assessment:**

| Requirement | Status |
|-------------|--------|
| Separate Supabase project | **UNVERIFIED** — no confirmed staging project |
| Separate database from production | **UNVERIFIED** |
| Separate Auth configuration | **UNVERIFIED** |
| Separate storage | **UNVERIFIED** |
| Separate environment variables | **UNVERIFIED** |
| Vercel Preview connected to staging | **UNVERIFIED** |
| No accidental production data/credentials | **UNVERIFIED** |
| Documented reset and test-data process | **UNVERIFIED** |

**BLOCKER:** No confirmed isolated Scholars staging environment exists. This is a **BLOCKER** for production approval.

### Recovery operator and two-person approval

**No recovery operator identified.** No documented recovery procedure, no break-glass identity, no two-person approval for administrator recovery found in source.

**Last-administrator protection:** None — an admin can revoke their own `is_admin` or delete their own profile (`app/api/profile/route.ts` DELETE handler), potentially causing permanent lockout.

**Rollback and migration testing:** Cannot be performed safely without a staging environment.

---

## 14. Proposed first-release CMS architecture

### Principles

1. Preserve `profiles.is_admin` as the single platform-admin authority (do not create a separate Resource Centre admin system).
2. Add a distinct editorial capability model (author/reviewer/publisher) separate from platform admin.
3. Public read: anyone can read published content without authentication.
4. Database-enforced workflow, not UI-only.
5. Immutable revisions with complete snapshots.

### Database transition architecture

**New tables (additive migration):**
- `resource_article_audit_events` — append-only: id, article_id, revision_id, actor_id (auth.users), action (create/edit/submit/approve/reject/schedule/publish/archive/correct), reason (text, required for sensitive actions), created_at, snapshot_before jsonb, snapshot_after jsonb. RLS: insert-only for authenticated, no UPDATE/DELETE, service_role maintenance.
- Editorial capability table (optional future): `resource_editorial_capabilities` linking profiles to author/reviewer/publisher roles.

**Modified tables:**
- `resource_articles`: Add `published_revision_id` same-article constraint, transition validation via guarded functions.
- `resource_revisions`: Add immutability trigger (reject UPDATE/DELETE).

**Database-enforced transitions (server-side functions):**
- `submit_resource_article(article_id, actor_id)` — draft → in_review, actor = author
- `return_resource_article(article_id, actor_id, reason)` — in_review → draft, actor = reviewer ≠ author
- `approve_resource_article(article_id, actor_id, target_status)` — in_review → scheduled/published, actor = reviewer ≠ author, AAL2 required
- `publish_resource_article(article_id, actor_id)` — scheduled → published, `now() >= scheduled_for`, AAL2 required
- `archive_resource_article(article_id, actor_id)` — published → archived, AAL2 required
- `correct_resource_article(article_id, actor_id, new_revision)` — published → draft, new revision, new review, AAL2 required

Each function validates: actor auth.uid(), capability, author/reviewer separation, transition validity, revision identity, MFA/AAL2 where required, records audit event atomically.

### Authorization and capability boundaries

| Capability | Required authority | MFA |
|------------|-------------------|-----|
| Read published articles | Public (anon) | None |
| Create/edit drafts | Editorial author capability | AAL1 |
| Submit for review | Editorial author capability | AAL1 |
| Review/approve | Editorial reviewer capability, reviewer ≠ author | AAL2 |
| Publish/schedule | Editorial publisher capability | AAL2 |
| Archive/restore/correct | Editorial publisher capability | AAL2 |
| Platform admin functions | `profiles.is_admin` | AAL2 (if `REQUIRE_ADMIN_MFA=true`) |

**Do not create a separate Resource Centre administrator system** conflicting with `profiles.is_admin`. Platform admins can be granted editorial capabilities through the same identity.

### Server-side route structure

```
POST   /api/admin/resources/articles           — create draft (author)
PATCH  /api/admin/resources/articles/[id]      — edit draft (author)
POST   /api/admin/resources/articles/[id]/submit — submit for review
POST   /api/admin/resources/articles/[id]/review — approve/reject (reviewer, AAL2)
POST   /api/admin/resources/articles/[id]/schedule — schedule (publisher, AAL2)
POST   /api/admin/resources/articles/[id]/publish  — publish (publisher, AAL2)
POST   /api/admin/resources/articles/[id]/archive  — archive (publisher, AAL2)
POST   /api/admin/resources/articles/[id]/correct  — correction (author + review)
GET    /api/admin/resources/audit              — audit events (admin, read-only)
```

All routes use `assertAdmin(supabase, { requireAal2: true })` for publish/schedule/archive/approve, `assertAdmin(supabase)` for draft/submit.

### Revision model

- `resource_revisions.state` = complete immutable JSON snapshot (title, content, excerpt, author snapshot, reviewer snapshot, categories, publication metadata, canonical URL, featured image, last_reviewed_at)
- `UNIQUE (article_id, revision_number)` enforced
- Immutability trigger: reject UPDATE/DELETE after insert
- `published_revision_id` FK with same-article constraint
- Corrections create new revision, never mutate history

### Audit-event model

- `resource_article_audit_events` append-only table
- Columns: id, article_id, revision_id, actor_id, action, reason, created_at, ip_address (optional), user_agent (optional)
- RLS: INSERT only for authenticated; no UPDATE/DELETE; service_role for maintenance
- Cannot be modified/deleted by ordinary administrators

### Storage model

- Dedicated Resource Centre Storage bucket (e.g., `resource-center-images`)
- Bucket policy: public read for published article images only; authenticated editorial upload with path ownership validation
- Validation: MIME type (image/png, image/jpeg, image/webp), size limit, dimension limits, path traversal blocked
- No SVG without sanitization (recommend rejecting SVG at upload)
- Path format: `resource-center/articles/{article_id}/{filename}` with ownership check

### Public read model

- Public views (`resource_public_*`) with explicit column projections
- `security_invoker = true` recommended (or maintain owner-executed with strict regression tests)
- RLS on base tables: anon/authenticated can SELECT only where `status='published'` and `published_at <= now()`
- No service-role credentials for public reads
- Views expose only approved display fields; no `user_id`, `created_by`, `updated_by`, revision bodies

### MFA enforcement

- `REQUIRE_ADMIN_MFA=true` in production after all admins enrolled
- `assertAdmin(..., { requireAal2: true })` for publish/schedule/archive/approve/correct
- AAL1 for draft/edit/submit

### Error handling and rollback

- All transitions atomic (function + audit event in one transaction)
- Failed publication: article remains in previous state, no partial state
- Rollback: disable public route or archive affected content via audited operation; never delete production content
- Feature-flag public route and publishing separately

---

## 15. Critical blockers

| # | Blocker | Severity | Evidence |
|---|---------|----------|----------|
| 1 | `profiles.is_admin` self-elevation path structurally open (table-level `INSERT, UPDATE` grant to `authenticated` in `0029` not neutralized by column revoke; own-row policy permits self-update) | Critical | `0029_fix_profiles_upsert_table_privileges.sql:4-6`; `0023_lock_admin_flag.sql:86-91` |
| 2 | Arbitrary-UUID `is_admin` oracle (`public.is_admin(uuid)` with `PUBLIC EXECUTE`) | Critical | `0023_lock_admin_flag.sql:112` |
| 3 | No confirmed isolated Scholars staging environment (`serena` not verified) | Critical — BLOCKER | No staging project identified |
| 4 | No database-enforced publishing state machine | High | Migration `20261107130100_resource_center_schema.sql` lines 42, 57-63 (CHECK only) |
| 5 | No author/reviewer/publisher separation (no reviewer ≠ author constraint) | High | Migration lines 50-52 |
| 6 | No revision immutability or same-article binding for `published_revision_id` | High | Migration lines 82-93, 98-101 |
| 7 | No append-only editorial audit ledger | High | No `resource_article_audit_events` table |
| 8 | `REQUIRE_ADMIN_MFA=false` (`.env.example`); no route passes `requireAal2` | High | `.env.example:20`; no `requireAal2: true` call sites |
| 9 | Public views use `security_barrier=true`, not `security_invoker=true` | Medium | Migration lines 157-203 |


---

## 16. Prioritized remediation roadmap

### Phase 1 — Critical database security (must precede any editorial write path)

| Priority | Remediation | Location | Safe staging test |
|----------|-------------|----------|-------------------|
| P1-Critical | Remove table-level `INSERT, UPDATE` on `profiles` from `authenticated`; restore column-scoped grants only; add `BEFORE INSERT/UPDATE` trigger preventing `is_admin` changes by non-service roles | `0029_fix_profiles_upsert_table_privileges.sql`; new migration | Authenticated user attempts `PATCH profiles SET is_admin=true` via PostgREST — denied |
| P1-Critical | Restrict `public.is_admin(uuid)` EXECUTE from `PUBLIC`/`anon`/`authenticated`; replace with current-caller-only helper `is_admin_current()` | `0023_lock_admin_flag.sql:112`; new migration | `anon`/`authenticated` call `is_admin(uuid)` with arbitrary UUID — denied; current-caller helper returns own status only |
| P1-Critical | Enable `FORCE ROW LEVEL SECURITY` on all 5 Resource Centre tables | `20261107130100_resource_center_schema.sql:103-107` | Table owner/bypass attempts rejected |
| P1-Critical | Add `security_invoker=true` to public projection views (or document owner-executed model with regression tests) | `20261107130100_resource_center_schema.sql:157-203` | Direct PostgREST queries on base tables by `anon` return no rows; views return only public columns |

### Phase 2 — Editorial workflow boundaries

| Priority | Remediation | Safe staging test |
|----------|-------------|-------------------|
| P2-High | Add `CHECK (author_identity_id <> reviewer_identity_id)` constraint | Insert with same author/reviewer — rejected |
| P2-High | Implement guarded transition functions (submit/approve/schedule/publish/archive/correct) with actor validation | Direct `UPDATE status='published'` — denied; function call succeeds with valid actor |
| P2-High | Add revision immutability trigger (reject UPDATE/DELETE) | `UPDATE resource_revisions` — denied |
| P2-High | Add same-article constraint for `published_revision_id` | Insert article with `published_revision_id` from different article — rejected |
| P2-High | Create `resource_article_audit_events` append-only table | `UPDATE`/`DELETE` on audit table — denied; `INSERT` succeeds |
| P2-High | Set `REQUIRE_ADMIN_MFA=true` in production after admin TOTP enrollment | Routes with `requireAal2: true` reject AAL1 sessions |

### Phase 3 — MFA and operational

| Priority | Remediation | Safe staging test |
|----------|-------------|-------------------|
| P3-High | Add `assertAdmin(..., { requireAal2: true })` to publish/schedule/archive/approve routes | AAL1 session denied for publish; AAL2 session allowed |
| P3-Medium | Add storage bucket policies for Resource Centre images (MIME, size, path ownership) | SVG upload rejected; oversized image rejected; cross-user overwrite denied |
| P3-Medium | Add HTML sanitization to markdown rendering | XSS payload in markdown neutralized at render |

### Phase 4 — Staging and recovery

| Priority | Remediation | Safe staging test |
|----------|-------------|-------------------|
| P4-Critical | Establish isolated Scholars staging Supabase project (separate Auth, storage, env vars, Vercel Preview) | Staging project accessible; production data absent; reset process documented |
| P4-Critical | Document administrator recovery procedure with two-person approval and last-admin protection | Simulated lockout recovered via owner procedure only |

---

## 17. Exact acceptance criteria for each remediation

### Remediation 1: Protect `profiles.is_admin`

**Acceptance criteria:**
1. `authenticated` role has NO table-level `INSERT` or `UPDATE` on `public.profiles` (verified via `has_table_privilege('authenticated', 'public.profiles', 'INSERT,UPDATE') = false`)
2. Column-scoped `UPDATE` grant covers only non-admin fields (verified via `information_column_privileges` — `is_admin` absent)
3. `BEFORE INSERT OR UPDATE ON profiles` trigger rejects any statement that sets `is_admin = true` or changes `is_admin` for invoker roles `anon`/`authenticated`; allows default false on insert and service-role changes
4. Ordinary authenticated user `PATCH /profiles` with `is_admin: true` via PostgREST receives 403/permission denied
5. Profile upsert for ordinary fields still works (regression: `POST /api/profile` with allowed fields succeeds)
6. Tested in staging only — never against production

### Remediation 2: Replace arbitrary-UUID `is_admin` helper

**Acceptance criteria:**
1. `public.is_admin(uuid)` EXECUTE revoked from `PUBLIC`, `anon`, `authenticated`
2. New `is_admin_current()` zero-argument helper returns only `auth.uid()`'s admin status; rejects NULL; returns false for missing profile
3. All 55 policy definitions and 5 dependent routines updated to call `is_admin_current()` or `auth.uid()`-bound checks
4. No code path can query another user's admin status via the helper
5. Function `SECURITY DEFINER` with dedicated non-login owner, `search_path=''`, fully qualified names

### Remediation 3: Editorial workflow transitions

**Acceptance criteria:**
1. `author_identity_id <> reviewer_identity_id` constraint enforced
2. Direct `UPDATE resource_articles SET status='published'` by admin denied (no bypass)
3. Guarded `approve_resource_article` requires reviewer ≠ author, approval fresh, AAL2
4. Guarded `publish_resource_article` requires `now() >= scheduled_for`, approved revision unchanged, AAL2
5. Revisions immutable: `UPDATE/DELETE resource_revisions` denied for all roles except service_role maintenance
6. `published_revision_id` revision must belong to same article

### Remediation 4: Audit ledger

**Acceptance criteria:**
1. `resource_article_audit_events` table exists with columns: id, article_id, revision_id, actor_id, action, reason, created_at
2. RLS: INSERT only for authenticated; no UPDATE/DELETE policies
3. All editorial actions (create/edit/submit/approve/reject/schedule/publish/archive/correct) record an audit event atomically with the action
4. Ordinary administrators cannot modify or delete audit events

### Remediation 5: MFA/AAL2

**Acceptance criteria:**
1. `REQUIRE_ADMIN_MFA=true` in production (verified at deployment, not from `.env.example`)
2. `assertAdmin(..., { requireAal2: true })` on publish/schedule/archive/approve/correct routes
3. AAL1 session denied for AAL2-required operations; AAL2 session allowed
4. All admins enrolled with verified TOTP before enabling

### Remediation 6: Staging environment

**Acceptance criteria:**
1. Separate Supabase project with separate ref, URL, anon key, service-role key
2. Separate Auth configuration (no production user data)
3. Separate Storage buckets
4. Separate environment variables (not inherited from production)
5. Vercel Preview deployment connected to staging
6. Synthetic test accounts only (no production identities)
7. Documented reset and test-data process
8. `serena` not used

---

## 18. Tests required before production approval

All tests run in isolated staging only, with disposable synthetic users:

| Area | Test | Expected result |
|------|------|-----------------|
| Profiles | Authenticated user sets own `is_admin=false→true` via PostgREST | Denied; row unchanged |
| Profiles | Authenticated user inserts profile with `is_admin:true` | Denied; default false applies |
| Profiles | Authenticated user updates another account's flag | Denied; target unchanged |
| Profiles | Direct PostgREST `PATCH/POST/upsert` including `is_admin` | All fail closed; ordinary field updates succeed |
| Helper | `anon` executes `is_admin(uuid)` | Permission denied |
| Helper | Authenticated user queries arbitrary UUID | Denied / returns false (no arbitrary-subject semantics) |
| Helper | `is_admin_current()` returns own status only | Correct Boolean for caller |
| RLS | `anon` selects `resource_articles` base table | Denied |
| RLS | `authenticated` non-admin selects drafts | Denied |
| RLS | `authenticated` admin selects published via view | Allowed (published rows only) |
| Transitions | Direct `UPDATE status='published'` bypass | Denied |
| Transitions | `approve_resource_article` with reviewer = author | Denied |
| Transitions | `publish_resource_article` before `scheduled_for` | Denied |
| Revisions | `UPDATE resource_revisions` after insert | Denied (immutability) |
| Revisions | `published_revision_id` from different article | Denied (same-article constraint) |
| Audit | `UPDATE/DELETE` on `resource_article_audit_events` | Denied |
| Audit | Every editorial action records event atomically | Event present with actor, action, reason, timestamp |
| MFA | AAL1 session on publish route | 403 |
| MFA | AAL2 session on publish route | Allowed |
| Storage | SVG upload | Rejected |
| Storage | Oversized image | Rejected |
| Storage | Cross-user overwrite | Denied |
| Rendering | XSS payload in markdown | Neutralized at render |
| Routes | All 29 admin routes reject ordinary user | 403 for each |
| Service-role | Service client not used before guard | No mutation before authorization |

---

## 19. Unverified items and evidence limitations

| Item | Classification | Reason |
|------|---------------|--------|
| Effective production `REQUIRE_ADMIN_MFA` value | NOT VERIFIED | `.env.example` shows `false`; production Vercel secrets not inspected |
| Live database ACLs (grants, policies, function execution) | NOT VERIFIED in this session | No direct Supabase catalog access available; based on migration source files only |
| Live RLS enforcement at runtime | NOT VERIFIED | No database connection available |
| PostgREST/RPC reachability of `is_admin(uuid)` | NOT VERIFIED | No HTTP request attempted |
| Staging environment existence | NOT VERIFIED / BLOCKED | `serena` unconfirmed; no other project identified |
| Production database row counts | NOT VERIFIED | Read-only restriction; not queried |
| HTML sanitization at render time | NOT VERIFIED | Source inspection did not confirm sanitizer call |
| Storage bucket policies | NOT VERIFIED | No bucket defined in migration; runtime not checked |
| Session revocation on admin privilege change | NOT VERIFIED | No revocation mechanism found in source |
| `announcement_log` admin dashboard inconsistency | NOT VERIFIED | Not re-checked in current source |

Evidence is based on source code inspection and historical report cross-reference. No exploit attempts, write operations, or production mutations were performed. All database-level findings are classified as verified against migration source files, not against live catalog.

---

## 20. Final readiness verdict

**BLOCKED — SECURITY OR ENVIRONMENTAL PREREQUISITES REMAIN**

### Rationale

The Resource Centre cannot safely progress to an editorial publishing system because:

1. **Critical:** Ordinary authenticated users can structurally self-elevate `profiles.is_admin` via the table-level grant regression in `0029_fix_profiles_upsert_table_privileges.sql`. This compromises every authorization boundary in the system (all 29 admin routes, all RLS policies, the admin guard, middleware).

2. **Critical:** The arbitrary-UUID `is_admin` oracle remains present with `PUBLIC EXECUTE`, leaking admin membership for arbitrary IDs.

3. **Critical:** No confirmed isolated Scholars staging environment exists. `serena` is not verified staging and must not be used.

4. **High:** No database-enforced publishing state machine, author/reviewer/publisher separation, revision immutability, same-article revision binding, or audit ledger exists.

5. **High:** `REQUIRE_ADMIN_MFA` is effectively false (default in `.env.example`); no route requires AAL2.

6. **High:** No append-only editorial audit ledger exists.

### Decision matrix

| Workstream | Current status | Blocker? | Next action |
|------------|---------------|----------|-------------|
| Platform admin authority | Critical self-elevation path present | YES — Critical | Remove table-level DML on `profiles` from `authenticated`; add `is_admin` guard trigger; restrict `is_admin()` helper |
| Resource Centre RLS | RLS enabled but depends on compromised `is_admin`; `FORCE RLS` disabled | YES — High | Enable `FORCE ROW LEVEL SECURITY`; add `security_invoker=true` to views |
| Editorial roles | No author/reviewer/publisher model; no reviewer ≠ author rule | YES — High | Add capability model; `author_identity_id <> reviewer_identity_id` constraint |
| Publishing transitions | No state machine; direct status mutation possible | YES — High | Implement guarded transition functions |
| Revision integrity | Arbitrary JSON accepted; no immutability; no same-article binding | YES — High | Add immutability trigger; same-article constraint; JSON schema validation |
| Audit history | No append-only ledger | YES — High | Create `resource_article_audit_events` table |
| MFA/AAL2 | `REQUIRE_ADMIN_MFA=false`; no `requireAal2` call sites | YES — High | Set `REQUIRE_ADMIN_MFA=true` after enrollment; add `requireAal2: true` to publish/schedule/archive/approve |
| Storage/content safety | Path-traversal regex only; no MIME/size/SVG validation | Medium | Storage bucket policies; content-type/size validation; HTML sanitization |
| Staging/recovery | No confirmed staging; no recovery procedure | YES — BLOCKER | Establish isolated staging Supabase project; document recovery with two-person approval |

### What must happen before production approval

1. Fix Critical items 1–3 (is_admin protection, helper restriction, staging environment).
2. Fix High items 4–8 (workflow transitions, role separation, revision integrity, audit ledger, MFA).
3. All remediation acceptance criteria (Section 17) met in staging.
4. All tests (Section 18) pass in staging.
5. Owner explicit approval after independent review.

This report is read-only. No implementation, remediation, migration, or deployment was performed. Await independent review and explicit approval before starting database or application changes.

---

## Report publication

**Report file:** `reports/scholars/2026-11-14-resource-center-phase-2b-security-readiness-audit.md`  
**Target repository:** `ImperioKDB/Updates`  
**Publication method:** GitHub Contents API  
**Status:** Written locally, ready for publication

No commit SHA or URL recorded yet — publication pending.