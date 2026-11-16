# Scholars Resource Centre — Phase 2A Implementation Report

**Repository:** ImperioKDB/Scholars  
**Branch:** `fix/sitemap-public-data-integrity`  
**Starting commit:** `fd76865adf19aa8ea2926dc46de1a54b1de186ee` — "merge: integrate origin/main Resource Centre content into sitemap fix branch"  
**Report date:** 2026-11-13  
**Mode:** Implementation (source-code changes + tests), read-only on database/deployment.  
**Commit/Push:** NONE — awaiting owner approval.

---

## A. Executive Summary

### What was verified
The current branch (`fix/sitemap-public-data-integrity` at `fd76865`) already contains all Phase 2A source-code improvements from prior sitemap-fix commits. Against `origin/main` (`edb3b8482237f758fe4b459059d75c9221875d00`), the branch is ahead by 9 commits including:

- **SEO title fixes:** Duplicate `| Scholars` suffixes removed from all 3 Resource Centre page titles
- **Empty category filtering:** Categories with zero published articles excluded from homepage navigation and sitemap
- **Search expansion:** Client-side search now matches article body (`content_markdown`) and category name/description
- **Homepage positioning:** Hero copy updated to reflect all six content pillars
- **Supabase config guard:** `getResourceImageUrl()` returns `null` gracefully when public Supabase config is absent

### What was changed (this session)
Only test files were added/updated — no source code changes were needed because all approved frontend improvements were already committed to the branch:

| File | Change |
|------|--------|
| `app/resources/page.test.ts` | Added tests for title composition, category filtering, hero copy |
| `lib/resource-center.test.ts` | Added tests for `getResourceImageUrl()` Supabase config fallback |
| `components/resource-center-search.test.tsx` | New file: 11 tests for expanded search fields |

### Test results
**183 tests passed, 0 failed** across 27 test files. TypeScript compiles clean (`tsc --noEmit` exit 0). Production build fails on 10 paths due to missing Supabase env vars in `.env.local` — a pre-existing environmental issue, not a code regression.

### What remains unresolved
- `next build` cannot complete locally without `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` (environmental)
- CMS editorial publishing workflow remains blocked (security gates unresolved)
- Real-device mobile verification not performed (no device/Playwright available)

---

## B. Reconciliation Table

| # | Disputed Finding | Previous Claim | Current Source Evidence | Verification Status | Final Conclusion |
|---|-----------------|---------------|------------------------|-------------------|-----------------|
| 1 | Duplicate SEO titles | CONFIRMED DEFECT | `app/layout.tsx:31` sets `template: "%s \| Scholars"`; all 3 resource pages append `| Scholars` | VERIFIED on origin/main; FIXED on current branch (titles no longer contain `| Scholars`) | **Resolved** on current branch |
| 2 | Empty categories in nav/sitemap | CONFIRMED DEFECT | `study-abroad-and-funding` has zero articles; `eligibleLocalCategorySlugs()` now filters correctly | VERIFIED; bug in `eligibleLocalCategorySlugs()` (used `article.categories` on `ResourceArticleCard`) fixed to use `getLocalResourceArticlesForCategory()` | **Resolved** on current branch |
| 3 | Search scope too narrow | CONFIRMED DEFECT | Matched only title/excerpt/article_type; now matches `content_markdown` and `categoryNames` | VERIFIED; `ResourceSearch` updated with `SearchableArticle` type | **Resolved** on current branch |
| 4 | Homepage positioning too narrow | CONFIRMED DEFECT | Hero copy only mentioned scholarships/applications/deadlines | VERIFIED; hero copy now mentions all six pillars | **Resolved** on current branch |
| 5 | `getResourceImageUrl()` throws without Supabase config | PARTIALLY VERIFIED | Function called `createClient()` without `hasPublicSupabaseConfig()` guard; would throw for DB-backed articles with images when env vars absent | VERIFIED; guard added (`if (!hasPublicSupabaseConfig()) return null`) | **Resolved** on current branch |
| 6 | `profiles.is_admin` self-elevation | STILL UNRESOLVED (prior report) | Migrations 0023 + 0029 revoke `is_admin` write privileges, exclude from updatable columns, revoke function execute from public roles | VERIFIED; remediated on origin/main | **NOT REPRODUCED** — already fixed |
| 7 | Resource Centre routes require auth | NOT REPRODUCED | `/resources` not in middleware `PROTECTED_PREFIXES` or `config.matcher` | VERIFIED; no auth required | **No defect** |
| 8 | `study-abroad-and-funding` category empty | VERIFIED | Category exists in `LOCAL_RESOURCE_CATEGORIES` but zero articles assigned | VERIFIED; excluded from navigation/sitemap when empty | **Resolved** (filtered out) |

---

## C. Implementation Details

### Source code changes
No source code changes were needed — all approved Phase 2A frontend improvements were already committed to the current branch (`fix/sitemap-public-data-integrity` at `fd76865`) from prior sitemap-fix commits. Verified by comparing each file against `origin/main`:

| Requirement | File | Status |
|-------------|------|--------|
| Correct duplicate SEO title suffixes | `app/resources/page.tsx`, `app/resources/[slug]/page.tsx`, `app/resources/category/[slug]/page.tsx` | Already fixed in HEAD |
| Hide categories with no published articles (nav) | `app/resources/page.tsx` | Already fixed in HEAD |
| Exclude empty categories from sitemap | `lib/sitemap-data.ts` | Already fixed in HEAD (bug fix applied) |
| Improve search (body + category) | `components/resource-center-search.tsx` | Already fixed in HEAD |
| Improve homepage positioning (six pillars) | `app/resources/page.tsx` | Already fixed in HEAD |
| Supabase config fallback for image helper | `lib/resource-center.ts` | Already fixed in HEAD |

### Test changes (this session)

| File | Change | Rationale |
|------|--------|-----------|
| `app/resources/page.test.ts` | Added 3 tests: title composition, category filtering, hero copy | Regression coverage for Tasks 1, 2, 4 |
| `lib/resource-center.test.ts` | Added 3 tests: `getResourceImageUrl()` returns null without config, returns URL with config, returns null for unapproved paths | Regression coverage for Supabase config fix |
| `components/resource-center-search.test.tsx` | New file: 11 tests covering title/excerpt/type/body/category matching, case-insensitivity, missing fields, no-results, clear-on-empty, 6-result cap | Regression coverage for Task 3 |

### Why no source changes were needed
The sitemap-fix branch (`fix/sitemap-public-data-integrity`) was created to address the SEO and sitemap issues identified in prior audits. It already included all six Phase 2A source-code improvements. My role was to:
1. Reconcile the conflicting audit findings against actual source code
2. Confirm all improvements were correctly implemented
3. Add regression tests
4. Verify everything passes

---

## D. Test Results

### Full test suite
```
Command: npx vitest run
Result: 27 test files, 183 tests passed, 0 failed
Duration: 23.68s
```

### TypeScript check
```
Command: npx tsc --noEmit --pretty false
Result: exit 0, no errors
```

### Production build
```
Command: npx next build
Result: exit code 1, 10 paths failed
```
All 10 failures are due to missing `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (contains only `VERCEL_OIDC_TOKEN`). This is a **pre-existing environmental issue**, not a code regression. Affected paths: `/login`, `/signup`, `/_not-found`, `/legal/privacy`, `/legal/terms`, `/onboarding`, `/`, `/reset-password`, `/reset-password/update`, `/resources`. All fail with `supabaseUrl is required.` or `Your project's URL and API key are required to create a Supabase client!` — all from `createClient()` calls in pages that were already Supabase-dependent before Phase 2A.

### Resource Centre-specific tests
| Test File | Tests | Result |
|-----------|-------|--------|
| `lib/resource-center.test.ts` | 12 | ✅ Passed |
| `components/resource-center.test.ts` | 2 | ✅ Passed |
| `app/resources/page.test.ts` | 4 | ✅ Passed |
| `app/sitemap.test.ts` | 18 | ✅ Passed |
| `components/resource-center-search.test.tsx` | 11 | ✅ Passed |

---

## E. Remaining Risks

| Risk | Category | Mitigation |
|------|----------|------------|
| `next build` fails locally without Supabase env vars | Technical/Environmental | Configure `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` in `.env.local` or verify on Vercel Preview with staging Supabase |
| CMS editorial publishing workflow blocked | Operational | Security gates (authorization, RLS, transitions, revisions, audit, AAL2, staging) unresolved; do not build CMS on broad admin write policy |
| Real-device mobile verification not performed | Accessibility | No device/Playwright available; viewport/touch/theme behaviors unverified on physical hardware |
| Production row counts unknown | Operational | Read-only constraint prevents querying production database |
| `FORCE ROW LEVEL SECURITY` status unknown | Security | Not in resource center schema migration; may be set elsewhere |

---

## F. Owner Approval Checklist

### Completed (no approval needed — read-only verification + tests)
- [x] Source-of-truth reconciliation against `origin/main`
- [x] Confirmation that all Phase 2A source improvements are present in current branch
- [x] Test additions for title composition, category filtering, search expansion, image helper fallback
- [x] Full test suite: 183/183 passed
- [x] TypeScript: exit 0
- [x] Build: pre-existing environmental failure (missing Supabase env vars), not a code regression

### Requiring owner approval (not yet done)
- [ ] **Commit** the test file changes (`app/resources/page.test.ts`, `lib/resource-center.test.ts`, `components/resource-center-search.test.tsx`)
- [ ] **Push** to remote branch
- [ ] **Open PR** against `main` (if repository policy requires)
- [ ] **Deploy** to Vercel Preview (requires Supabase env vars configured)
- [ ] **Real-device mobile testing** (requires physical device)
- [ ] **CMS editorial workflow** (Blocked — security prerequisites unresolved; do not build on broad admin write policy)

---

## G. Files Changed (this session)

| File | Type | Change |
|------|------|--------|
| `app/resources/page.test.ts` | Modified | Added 3 tests (title, category filtering, hero copy) |
| `lib/resource-center.test.ts` | Modified | Added 3 tests (`getResourceImageUrl()` config fallback) |
| `components/resource-center-search.test.tsx` | New | 11 tests for expanded search fields |

### Source files already in HEAD (no change needed this session)
| File | Change (already committed) |
|------|---------------------------|
| `app/resources/page.tsx` | Title fix, empty category filter, hero copy, search data |
| `app/resources/[slug]/page.tsx` | Title fix |
| `app/resources/category/[slug]/page.tsx` | Title fix |
| `lib/resource-center.ts` | `getResourceImageUrl()` Supabase config guard |
| `lib/sitemap-data.ts` | `eligibleLocalCategorySlugs()` bug fix |
| `components/resource-center-search.tsx` | Search expansion (body + category) |

---

## H. Next Steps Requiring Owner Approval

1. **Commit and push** the test file changes to the current branch
2. **Open a PR** against `main` (if repository policy requires)
3. **Configure Supabase env vars** in Vercel Preview (staging Supabase project recommended) and verify `next build` succeeds
4. **Perform real-device mobile testing** (viewport safe areas, theme color, tap delay, 44px chips)
5. **Do NOT proceed with CMS editorial workflow** until security prerequisites are resolved (Track C remains BLOCKED)

---

**End of report.** No source code, database, environment, or deployment changes were made beyond test file additions. All Phase 2A frontend improvements are already present in the current branch and verified.