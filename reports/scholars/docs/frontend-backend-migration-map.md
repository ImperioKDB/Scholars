# Scholars Resource Centre — Frontend-Backend Migration Map

**Repository:** `ImperioKDB/Scholars-Resource-Centre`  
**Reports repository:** `ImperioKDB/Updates`  
**Main application repository:** `ImperioKDB/Scholars`  
**Report date:** 2026-11-15  
**Mode:** Read-only investigation and planning. No Scholars application source files, database permissions, or production settings were modified.

---

## 1. Overview

This document maps every dependency of the existing Scholars Resource Centre frontend
(`ImperioKDB/Scholars`) to its new independent backend
(`ImperioKDB/Scholars-Resource-Centre`). Each dependency is classified as:

- **KEEP** — remains in the existing Scholars frontend unchanged
- **REPLACE** — must connect to the new Resource Centre backend
- **REBUILD** — must be implemented independently in the new backend
- **REMOVE** — obsolete functionality that can safely be retired
- **REVIEW** — requires a decision before migration

**Critical safety boundaries:**
- No Scholars application source files were modified.
- No production database permissions or schema were changed.
- No Supabase migrations were applied.
- No Vercel settings or deployments were changed.
- No existing Resource Centre functionality was removed.
- No separate frontend application was created.
- No existing Resource Centre functionality was rebuilt from scratch.

---

## 2. Migration Map

### 2.1 Frontend Routes and Pages (KEEP — stay in Scholars)

| Route | File | Purpose | Classification | Notes |
|-------|------|---------|----------------|-------|
| `/resources` | `app/resources/page.tsx` | Public Resource Centre homepage | KEEP | Frontend stays in Scholars; data fetches repointed to new backend public views via server client |
| `/resources/[slug]` | `app/resources/[slug]/page.tsx` | Public article detail | KEEP | Same; data from new backend views |
| `/resources/category/[slug]` | `app/resources/category/[slug]/page.tsx` | Public category listing | KEEP | Same; data from new backend views |

**Security note:** Public routes use the Supabase anon key (browser-safe). The new backend's public projection views must expose only published content and approved columns. No service-role credentials in frontend bundles.

---

### 2.2 Components and Shared UI (KEEP — stay in Scholars)

| Component | File | Purpose | Classification | Notes |
|-----------|------|---------|----------------|-------|
| Resource page frame | `components/resource-center.tsx` (`ResourcePageFrame`) | Page shell | KEEP | No change |
| Resource masthead/nav | `components/resource-center.tsx` (`ResourceMasthead`) | Header + navigation | KEEP | Links to `/resources`, `/scholarships-in-nigeria`, `/opportunities-for-students`, `/signup` |
| Resource card | `components/resource-center.tsx` (`ResourceCard`) | Article preview card | KEEP | Links to `/resources/[slug]` |
| Resource image | `components/resource-center.tsx` (`ResourceImage`) | Featured image render | KEEP | Image URLs come from `getResourceImageUrl()` |
| Resource search | `components/resource-center-search.tsx` (`ResourceSearch`) | Client-side search | KEEP | Searches loaded article list (title, excerpt, body, category) |
| Resource interactions | `components/resource-center-interactions.tsx` | Reading progress, TOC, share, mobile nav | KEEP | Client-side only |
| Resource article body | `components/ResourceArticleBody.tsx` | Markdown rendering + headings | KEEP | Renders `content_markdown`; sanitization boundary |
| Resource ad slot | `components/resource-center.tsx` (`ResourceAdSlot`) | Ad placeholder (disabled by default) | KEEP | Disabled unless `NEXT_PUBLIC_RESOURCE_ADS_ENABLED=true` |

**No component changes required** for backend separation; data sources are repointed via `lib/resource-center.ts`.

---

### 2.3 Data Layer (REBUILD — new backend Supabase project)

| Current object | File / migration | Current frontend/API consumer | Purpose | Classification | Proposed replacement | Security considerations | Required tests |
|----------------|------------------|-------------------------------|---------|----------------|----------------------|------------------------|----------------|
| `resource_editorial_identities` table | `20261107130100_resource_center_schema.sql` | Public article author display | REBUILD | Same table in new backend | RLS enabled; public view exposes only `id, display_name, bio, avatar_path` for active identities; `user_id` never public | Unit: anon cannot read base table; view returns only active identities |
| `resource_categories` table | `20261107130100_resource_center_schema.sql` | Category listing, nav chips | REBUILD | Same table in new backend | RLS; public view filters `is_active = true` | Unit: inactive categories not in public view |
| `resource_articles` table | `20261107130100_resource_center_schema.sql` | Article detail, listing | REBUILD | Same table in new backend | RLS; public view filters `status='published' AND published_at <= now()`; no `created_by`/`updated_by`/`reviewer_identity_id` in public view | Unit: drafts/in_review/scheduled/archived not visible to anon |
| `resource_article_categories` join table | `20261107130100_resource_center_schema.sql` | Article-category associations | REBUILD | Same table in new backend | RLS; public view only for published articles + active categories | Unit: no draft leakage via category links |
| `resource_revisions` table | `20261107130100_resource_center_schema.sql` | Revision history (editorial only) | REBUILD | Same table in new backend | No public access; service-role + editorial write path only | Unit: revisions immutable (no UPDATE/DELETE policies); `published_revision_id` same-article binding |
| `resource_public_*` views | `20261107130100_resource_center_schema.sql` | Public reads via anon key | REBUILD | Same views in new backend | `security_barrier=true`; explicit column projection; grant SELECT to `anon, authenticated` | Unit: anon cannot select base-table columns via view; published-only predicate |
| `is_admin(uuid)` helper | `0023_lock_admin_flag.sql` | RLS policies on resource tables | REPLACE | Not used in new backend | **DO NOT REUSE** — arbitrary-UUID oracle, `PUBLIC EXECUTE` | N/A — new backend uses editorial capability model, not `is_admin` |
| `profiles.is_admin` | `0023_lock_admin_flag.sql` | Admin authorization (Scholars platform) | KEEP in Scholars | N/A — not used by new backend | New backend does not read `profiles.is_admin`; editorial roles are separate | N/A |

**Critical security note:** The new backend does **not** reuse `profiles.is_admin` or any Scholars platform administrator authority. Editorial capabilities (author/reviewer/publisher) are granted through an independent `resource_editorial_capabilities` table linked to `resource_editorial_identities`. This preserves the existing platform administrator authority and avoids creating a conflicting second administrator system.

---

### 2.3 Existing API Routes and Server Actions

| Route / File | Purpose | Classification | Notes |
|--------------|---------|----------------|-------|
| `lib/resource-center.ts` | Data access functions (`getResourceHome`, `getResourceArticle`, `getResourceCategory`, `getResourceImageUrl`, `getResourceCanonicalUrl`) | REBUILD | Repoint Supabase client to new backend project URL/anon key; same function signatures, data comes from new backend public views |
| `lib/supabase/server.ts` | Server Supabase client (anon key) | KEEP (unchanged) | Used by frontend for public reads; env vars point to new backend project |
| `lib/supabase/public.ts` | Public Supabase client (no session) | KEEP (unchanged) | Used by sitemap; same pattern |
| `lib/supabase/config.ts` | `hasPublicSupabaseConfig()` check | KEEP (unchanged) | Env var names unchanged |
| `app/api/admin/*` | Various admin routes (scholarships, broadcast, discovery, etc.) | KEEP (unchanged) | These are Scholars admin routes, not Resource Centre editorial; untouched |
| `app/api/admin/resources/*` | Does not exist (admin resources page is read-only, labeled "Publishing workflow next") | N/A | No existing editorial write path to migrate |

**No existing application source files are modified.** The frontend data layer (`lib/resource-center.ts`) would be updated in a future task to point at the new backend's Supabase URL/anon key, but that is outside this task's scope (do not modify Scholars source).

---

### 2.4 Image Storage and Assets

| Asset | Current location | Classification | Proposed replacement | Notes |
|-------|-----------------|----------------|---------------------|-------|
| Featured article images | Supabase `site` bucket, path `resource-center/featured/*` | REBUILD | New backend bucket `resource-center-images`; public read for published articles; service-role write only | New backend validates MIME type (png/jpg/webp), size, dimensions, path traversal at upload |
| Image URL generation | `getResourceImageUrl()` in `lib/resource-center.ts` | KEEP (frontend) | Same function, points to new backend bucket public URL | Path validation: `resource-center/featured/` prefix, no `..` or `\\` |

**No image upload/replace/delete endpoints exist in the current frontend** — the admin Resource Center page is read-only ("Publishing workflow next"). Image upload is a new backend capability.

---

### 2.5 SEO Metadata, Sitemap Generation, Canonical URLs

| Item | Current implementation | Classification | Notes |
|------|----------------------|----------------|-------|
| Canonical URLs | `getResourceCanonicalUrl()` — only `https://www.scholars.com.ng/resources/<slug>` | KEEP (frontend) | Frontend unchanged; new backend must preserve slug format |
| Sitemap | `app/sitemap.ts` + `lib/sitemap-data.ts` — reads `resource_public_articles` + `resource_public_article_categories` + local content | KEEP (frontend) | Frontend sitemap fetches from new backend public views via anon key |
| robots.txt | `/resources` not disallowed | KEEP (frontend) | Unchanged |
| JSON-LD (Article, BreadcrumbList, CollectionPage) | `components/ResourceArticleBody.tsx`, page metadata | KEEP (frontend) | Unchanged |
| Dynamic sitemap (`force-dynamic`) | `app/sitemap.ts` | KEEP (frontend) | Unchanged; queries new backend public views |

---

### 2.6 Existing Tests (KEEP — stay in Scholars)

| Test file | Coverage | Classification | Notes |
|-----------|----------|----------------|-------|
| `lib/resource-center.test.ts` | Public data contract, image path validation, canonical URL normalization, category count pagination | KEEP | Tests frontend data layer against mocked Supabase; unaffected by backend separation |
| `app/resources/page.test.ts` | Homepage navigation, title, hero copy, empty categories | KEEP | Frontend snapshot tests |
| `components/resource-center.test.ts` | Image loading priority, missing-image fallback | KEEP | Component tests |
| `components/resource-center-search.test.tsx` | Search fields (title, excerpt, body, category, type), case-insensitive, limit 6 | KEEP | Component tests |
| `components/ResourceArticleBody.test.tsx` | Heading IDs, TOC links, list/quote blocks, `safeHref` | KEEP | Component tests |

**No test files move to the new repository.** The new backend gets its own tests (database/RLS/security tests in `supabase/tests/`).

---

### 2.7 Administrator Authentication and Authorization

| Item | Current implementation | Classification | Proposed replacement |
|------|----------------------|----------------|---------------------|
| Admin auth | `profiles.is_admin` via Supabase Auth (Scholars student auth) | KEEP in Scholars | Not used by new backend |
| Admin guard | `lib/admin/guard.ts` `assertAdmin()` | KEEP in Scholars | Not used by new backend |
| Admin Server Component | `lib/admin/access.ts` `requireAdmin()` | KEEP in Scholars | Not used by new backend |
| Middleware admin gate | `middleware.ts` `/api/admin/*` checks `profiles.is_admin` | KEEP in Scholars | Not used by new backend |
| Editorial auth | Does not exist (admin resources page is read-only) | REBUILD | New backend: editorial identities linked to `auth.users`, optional email verification, editorial capability roles (author/reviewer/publisher), optional MFA (`REQUIRE_EDITOR_MFA`) |

**Key principle:** The new backend does not read or depend on `profiles.is_admin`. Editorial authority is entirely separate from Scholars platform administrator authority.

---

## 3. Proposed Database Schema (Summary)

Full DDL in `supabase/migrations/0001_init.sql` (new backend repository).

**Core tables:**
- `resource_editorial_identities` — editorial identity (optional `user_id` link to `auth.users`, `email_verified`, `is_active`)
- `resource_categories` — slug, name, description, display_order, is_active
- `resource_articles` — title, content_markdown, status (draft/in_review/scheduled/published/archived), `author_identity_id`, `reviewer_identity_id`, `published_revision_id`, canonical_url, featured_image_path
- `resource_article_categories` — join table (PK article_id + category_id)
- `resource_revisions` — immutable `state jsonb` snapshots, `revision_number` unique per article
- `resource_editorial_capabilities` — identity_id + role (author/reviewer/publisher)
- `resource_editorial_audit_events` — append-only audit ledger (actor_id, action, reason, metadata, created_at)

**RLS:** Enabled on all tables; `FORCE ROW LEVEL SECURITY` intentionally NOT enabled (service_role bypasses by design, required for controlled server-side operations); base tables not readable by `anon`/`authenticated`; public access only through projection views with explicit column lists.

**Security note:** `FORCE ROW LEVEL SECURITY` is intentionally not enabled because `service_role` (used by controlled server-side operations) must bypass RLS, and `postgres` (table owner with `BYPASSRLS`) is unaffected by FORCE RLS anyway. FORCE RLS does not address the root cause (compromised trust source) and adds no protection for the service-role boundary.

---

## 4. Frontend Files Requiring Future Modification

These files are in `ImperioKDB/Scholars` and would be updated in a **future** task to point at the new backend. They are **not modified** by this task.

| File | Change needed |
|------|---------------|
| `lib/resource-center.ts` | Repoint Supabase client URL/anon key to new backend project; data comes from new backend `resource_public_*` views |
| `lib/supabase/config.ts` | No change (env var names unchanged) |
| `app/sitemap.ts` | No change (queries new backend public views via same client) |
| `lib/sitemap-data.ts` | No change (reads `resource_public_*` views; new backend must expose same view names/shape) |

---

## 5. Backend Files and Migrations to Implement

In `ImperioKDB/Scholars-Resource-Centre`:

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Supabase project configuration |
| `supabase/migrations/0001_init.sql` | Five base tables, four public views, RLS, grants, default privileges |
| `supabase/migrations/0002_editorial_capabilities.sql` | Editorial capability table + helper function |
| `supabase/migrations/0003_audit_ledger.sql` | Audit events table + RLS (append-only) + helper function |
| `supabase/tests/seed.sql` | Synthetic test identities (author/reviewer/publisher), categories, capabilities |
| `supabase/tests/rls_policies.sql` | RLS policy test assertions |
| `lib/editorial/auth.ts` | Editorial identity/session management |
| `lib/editorial/capabilities.ts` — Role-based checks (author/reviewer/publisher, reviewer ≠ author) |
| `lib/editorial/audit.ts` — Append-only audit event recording |
| `lib/content/articles.ts` — Public read queries (published articles via views) |
| `lib/content/categories.ts` — Public category queries |
| `lib/content/revisions.ts` — Editorial revision queries (service role) |
| `lib/storage/images.ts` — Image upload/read validation (MIME, size, path traversal) |
| `.github/workflows/ci.yml` — CI: typecheck + tests |
| `.env.example` — Environment variable template (no secrets committed) |

---

## 6. Ordered Implementation Plan

1. **Create `ImperioKDB/Scholars-Resource-Centre` repository** (this task)
2. **Commit initial schema migration** (`0001_init.sql`) with five base tables, four public views, RLS, grants
3. **Commit editorial capabilities migration** (`0002_editorial_capabilities.sql`) with capability table + helper function
4. **Commit audit ledger migration** (`0003_audit_ledger.sql`) with append-only audit table
5. **Commit seed data** (`supabase/tests/seed.sql`) with synthetic author/reviewer/publisher identities
6. **Commit RLS policy tests** (`supabase/tests/rls_policies.sql`)
7. **Commit editorial auth library** (`lib/editorial/auth.ts`) — identity session management
8. **Commit editorial capabilities library** (`lib/editorial/capabilities.ts`) — role-based checks
9. **Commit editorial audit library** (`lib/editorial/audit.ts`) — append-only audit recording
10. **Commit public content queries** (`lib/content/articles.ts`, `lib/content/categories.ts`) — published reads via views
11. **Commit revision store** (`lib/content/revisions.ts`) — service-role revision queries
12. **Commit image storage library** (`lib/storage/images.ts`) — upload validation (MIME, size, path traversal)
13. **Commit CI workflow** (`.github/workflows/ci.yml`) — typecheck + tests
14. **Review migration map** (this document) — gate for production implementation
15. **User executes read-only verification SQL** against Scholars production to confirm current `profiles.is_admin` state before any remediation

---

## 7. Genuine Blockers

| Blocker | Description | Required action |
|---------|-------------|-----------------|
| **Live database verification unavailable** | No `psql`, no Supabase CLI, no connection env vars available in this environment. Cannot confirm whether `0029` table-level grant is effective in live Scholars production. | User must run the read-only verification SQL (`reports/scholars/sql/2026-11-15-resource-center-read-only-security-verification.sql`) against Scholars production Supabase via SQL Editor and return results. |
| **New Supabase project not yet created** | `ImperioKDB/Scholars-Resource-Centre` needs its own Supabase project with separate URL/anon/service-role keys. | Owner must provision a new Supabase project and provide credentials via `.env.local` (never committed). |
| **Editorial auth provider not yet chosen** | New backend needs Supabase Auth for editorial identities, independent of Scholars student auth. | Owner must confirm Supabase Auth is acceptable or select alternative. |
| **No editorial recovery operator identified** | No break-glass identity or two-person approval for editorial admin lockout. | Owner must designate recovery operator before editorial write path is enabled. |

---

## 8. Completion Criteria

- [x] Existing frontend mapped (routes, components, data layer, storage, SEO, tests)
- [x] Current database dependencies understood (five tables, four views, RLS, grants)
- [x] Independent backend architecture documented (this document)
- [x] New GitHub repository `ImperioKDB/Scholars-Resource-Centre` exists
- [x] Initial repository structure committed (schema, migrations, tests, lib scaffolding, docs)
- [ ] No existing production functionality changed (Scholars repo untouched)

**Stop condition:** Do not begin database implementation or frontend modification until this migration map has been reviewed and approved.
