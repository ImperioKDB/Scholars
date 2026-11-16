# Scholars Resource Centre — Phase 2A Final Verification Report

**Repository:** ImperioKDB/Scholars  
**Working directory:** `/workspaces/Scholars`  
**Report date:** 2026-11-13  
**Mode:** Read-only verification. No commits, pushes, merges, or deployments.

---

## A. Branch Comparison (Corrected)

| Item | Value |
|------|-------|
| Local branch | `fix/sitemap-public-data-integrity` |
| Local HEAD | `8b6de63162d52d8d950af52acd608ec95e54578d` — "fix(seo): data-driven Resource Centre category eligibility and cleanup" |
| Remote branch | `origin/fix/sitemap-public-data-integrity` (exists on origin) |
| Default branch | `origin/main` |
| origin/main HEAD | `edb3b8482237f758fe4b459059d75c9221875d00` — "feat: add NMSS government form guidance" |
| Merge base (origin/main ... HEAD) | `edb3b8482237f758fe4b459059d75c9221875d00` (origin/main itself) |
| Is origin/main ancestor of HEAD? | **YES** |
| Commits ahead (origin/main..HEAD) | **1404** (not 9 as previously claimed) |
| Commits behind (HEAD..origin/main) | **0** |

### Commit-count discrepancy resolution
The Phase 2A implementation report stated the branch was "ahead by 9 commits" relative to origin/main. This was **incorrect**. `git rev-list --count origin/main..HEAD` returns **1404 commits ahead**, with 0 behind. origin/main is a direct ancestor of HEAD. The local branch is a long-running feature branch that has accumulated 1404 commits not yet on origin/main.

This discrepancy does not affect the validity of the Phase 2A changes — they are verified against actual source on HEAD.

---

## B. Working Tree Status

```
 M app/resources/page.test.ts
 M lib/resource-center.test.ts
?? components/resource-center-search.test.tsx
?? reports/
```

- `app/resources/page.test.ts`: tracked, modified (unstaged)
- `lib/resource-center.test.ts`: tracked, modified (unstaged)
- `components/resource-center-search.test.tsx`: untracked (new file)
- `reports/`: untracked directory (implementation reports)

All three test files exist locally but are **uncommitted**. No source code files are modified.

---

## C. Source-of-Truth Findings: Phase 2A Implementation

Each approved change was verified against both `origin/main` and local HEAD by direct source inspection.

### Task 1 — Correct SEO title composition
| Item | origin/main | Local HEAD | Status |
|------|-------------|------------|--------|
| Home page title | `"Resource Center for students \| Scholars"` (duplicate) | `"Resource Center for students"` (fixed) | **Fixed on HEAD, not on main** |
| Article page title | `` `${article.title} \| Scholars` `` (duplicate) | `article.title` (fixed) | **Fixed on HEAD, not on main** |
| Category page title | `` `${result.category.name} resources \| Scholars` `` (duplicate) | `` `${result.category.name} resources` `` (fixed) | **Fixed on HEAD, not on main** |

Root layout `app/layout.tsx:31` sets `template: "%s | Scholars"`. Page-level titles that already append `| Scholars` produce doubled suffixes (`"Resource Center for students | Scholars | Scholars"`). The fix removes `| Scholars` from page-level titles and lets the root template append it once.

Files: `app/resources/page.tsx`, `app/resources/[slug]/page.tsx`, `app/resources/category/[slug]/page.tsx`

### Task 2 — Empty category filtering (navigation)
| Item | origin/main | Local HEAD | Status |
|------|-------------|------------|--------|
| Homepage nav | `visibleCategories = categories.length > 0 ? categories : LOCAL_RESOURCE_CATEGORIES` (no article-count filter) | `visibleCategories = categories.filter(c => getLocalResourceArticlesForCategory(c.slug).length > 0)` | **Fixed on HEAD, not on main** |

On origin/main, all categories render regardless of article count, producing empty `ResourceEmptyState` pages for `study-abroad-and-funding` (zero articles). On HEAD, categories with zero published articles are excluded.

Files: `app/resources/page.tsx`

### Task 3 — Empty category filtering (sitemap)
| Item | origin/main | Local HEAD | Status |
|------|-------------|------------|--------|
| `readAllResourceCategoryRows()` | Returns ALL categories without article-count filter | Filters via `eligibleLocalCategorySlugs()` (only categories with ≥1 published article) | **Fixed on HEAD, not on main** |

On origin/main, `readAllResourceCategoryRows()` returns every category slug with no article-count guard. On HEAD, `eligibleLocalCategorySlugs()` uses `getLocalResourceArticlesForCategory()` to determine which categories have published articles, and `readAllResourceCategoryRows()` filters accordingly.

Bug fix in HEAD: the original `eligibleLocalCategorySlugs()` incorrectly iterated `article.categories` on `ResourceArticleCard` objects (which don't have a `categories` property). This was fixed to iterate `LOCAL_RESOURCE_CATEGORIES` and use `getLocalResourceArticlesForCategory()` instead.

Files: `lib/sitemap-data.ts`, `app/sitemap.ts`

### Task 4 — Expanded article search
| Item | origin/main | Local HEAD | Status |
|------|-------------|------------|--------|
| Search fields | `title + excerpt + article_type` only | `title + excerpt + article_type + content_markdown + categoryNames` | **Fixed on HEAD, not on main** |

On origin/main, `ResourceSearch` matches only title, excerpt, and article type. On HEAD, it also matches article body (`content_markdown`) and category name/description via a `SearchableArticle` type extension.

Files: `components/resource-center-search.tsx`, `app/resources/page.tsx` (passes searchable data)

### Task 5 — Six-pillar homepage positioning
| Item | origin/main | Local HEAD | Status |
|------|-------------|------------|--------|
| Hero copy | "Clear, practical articles about scholarships, applications, deadlines..." | "Practical guides on scholarships, applications, academic development, skills, student life, and educational systems..." | **Fixed on HEAD, not on main** |

The original copy framed the Resource Centre exclusively around scholarships/applications/deadlines. The updated copy references all six pillars while keeping the scholarship/application focus prominent.

File: `app/resources/page.tsx`

### Task 6 — Supabase configuration fallback
| Item | origin/main | Local HEAD | Status |
|------|-------------|------------|--------|
| `getResourceImageUrl()` | Calls `createClient()` unconditionally (throws if env vars absent) | Guards with `hasPublicSupabaseConfig()`, returns `null` if absent | **Fixed on HEAD, not on main** |

On origin/main, `getResourceImageUrl()` calls `createClient()` without checking `hasPublicSupabaseConfig()`. `createClient()` reads `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `!ANON_KEY` directly and throws when either is absent. On HEAD, the function returns `null` gracefully when config is absent.

Files: `lib/resource-center.ts`

---

## D. Test Quality Review

### `app/resources/page.test.ts` (4 tests)
| Test | Type | Quality |
|------|------|---------|
| No circular "View all" link | Source-grep | Superficial but valid — guards against a specific regression |
| No duplicate `| Scholars` title suffix | Source-grep | Verifies source contains correct title string. Does not render the page to check actual `<title>` output. |
| Excludes empty categories | Source-grep | Verifies source contains `getLocalResourceArticlesForCategory` and `localArticles.length > 0`. Does not test runtime behavior. |
| Six-pillar hero copy | Source-grep | Verifies source contains pillar keywords. Does not test rendered output. |

**Assessment:** These are source-contract tests (reading source files and asserting string presence), consistent with the repo's existing test style (e.g., `components/resource-center.test.ts`). They verify the source contains the right patterns but do not test runtime behavior. They are complementary to, not a substitute for, behavioral tests.

### `lib/resource-center.test.ts` (3 new tests)
| Test | Type | Quality |
|------|------|---------|
| Returns null when Supabase config absent | Behavioral (env var manipulation) | Strong — deletes env vars, expects `null`. Properly restores env in `afterEach`. |
| Returns public URL when config present | Behavioral (env var manipulation) | Strong — sets env vars, expects URL. |
| Returns null for unapproved paths | Behavioral | Tests path traversal protection with `../../../etc/passwd` and `null`. |

**Assessment:** Behavioral tests with proper setup/teardown. Good quality. They protect against the original defect (unguarded `createClient()` call).

### `components/resource-center-search.test.tsx` (11 new tests)
| Test | Type | Quality |
|------|------|---------|
| Matches article title | Behavioral (RTL) | Strong — renders component, types input, checks rendered link |
| Matches article excerpt | Behavioral (RTL) | Strong |
| Matches article type | Behavioral (RTL) | Strong |
| Matches article body (`content_markdown`) | Behavioral (RTL) | Strong — verifies body search works with realistic content |
| Matches category name | Behavioral (RTL) | Strong — verifies category search uses correct relationships |
| Case-insensitive | Behavioral (RTL) | Strong |
| Handles missing `content_markdown` | Behavioral (RTL) | Strong — sets `content_markdown: undefined` |
| Handles missing `categoryNames` | Behavioral (RTL) | Strong — sets `categoryNames: undefined` |
| No results message | Behavioral (RTL) | Strong |
| Clears results on empty query | Behavioral (RTL) | Strong |
| Limits to 6 results | Behavioral (RTL) | Strong — uses 10 articles, expects 6 links |

**Assessment:** All tests are behavioral using @testing-library/react. They properly protect against the original defects:
- **Body search:** Test verifies "identifiable provider" (body-only term) finds the article.
- **Category search:** Test verifies "scam awareness" (category-only term) finds the article.
- **Missing fields:** Tests handle undefined `content_markdown` and `categoryNames` safely.
- **Result limit:** Test verifies 10 articles → 6 results.

**Client-side payload concern:** The search component receives articles with `content_markdown` included, meaning full article body text is sent to the client for every article. For 6 articles this is acceptable. For larger datasets, this could be a payload concern, but no database migrations or architectural changes were introduced (consistent with task requirements).

---

## E. Build Status

```
Command: npx next build
Result: exit code 1, 10 paths failed
Failing paths: /login, /signup, /_not-found, /legal/privacy, /legal/terms, /onboarding, /, /reset-password, /reset-password/update, /resources
Error: "supabaseUrl is required." / "Your project's URL and API key are required to create a Supabase client!"
```

### Classification: BLOCKED (environmental, not a code regression)

The build fails because `.env.local` contains only `VERCEL_OIDC_TOKEN` and is missing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These are required by `createClient()` (`lib/supabase/server.ts:36-37`), which reads them directly with no guard. All 10 failing pages are pre-existing Supabase-dependent pages. This is **not** caused by Phase 2A changes — the same failure exists on origin/main.

No Supabase credentials were invented, hardcoded, or exposed. No production environment variables were modified.

---

## F. Test Results

```
Command: npx vitest run
Result: 27 test files, 183 tests passed, 0 failed
Duration: ~24s
```

```
Command: npx tsc --noEmit --pretty false
Result: exit 0, no errors
```

| Test scope | Result |
|------------|--------|
| Full suite | 183/183 passed |
| Resource Centre tests | `lib/resource-center.test.ts` (12), `components/resource-center.test.ts` (2), `app/resources/page.test.ts` (4), `app/sitemap.test.ts` (18), `components/resource-center-search.test.tsx` (11) — all passed |
| TypeScript | exit 0 |
| Production build | BLOCKED (missing Supabase env vars — pre-existing environmental issue) |

---

## G. Outstanding Risks

| Risk | Category | Severity |
|------|----------|----------|
| `next build` fails without Supabase env vars | Technical/Environmental | High — blocks deployment verification |
| CMS editorial workflow blocked | Operational | High — security gates unresolved (Track C) |
| Real-device mobile verification not performed | Accessibility | Medium — no device/Playwright available |
| Production row counts unknown | Operational | Low — read-only constraint |
| Source-code changes uncommitted | Process | Medium — test files exist but not committed |

---

## H. Files Awaiting Publication

| File | Status | Location |
|------|--------|----------|
| `app/resources/page.test.ts` | Modified, uncommitted | `/workspaces/Scholars/app/resources/page.test.ts` |
| `lib/resource-center.test.ts` | Modified, uncommitted | `/workspaces/Scholars/lib/resource-center.test.ts` |
| `components/resource-center-search.test.tsx` | New, untracked | `/workspaces/Scholars/components/resource-center-search.test.tsx` |
| `reports/scholars/2026-11-13-resource-center-phase-2a-final-verification.md` | New, untracked | `/workspaces/Scholars/reports/scholars/2026-11-13-resource-center-phase-2a-final-verification.md` |

---

## I. Is Implementation Safe for PR Review?

**Yes, with the following caveats:**

1. All 6 Phase 2A source-code improvements are verified present on the local branch (HEAD `8b6de63`) and absent on `origin/main` (`edb3b848`).
2. All 183 tests pass, TypeScript compiles clean.
3. The build failure is pre-existing/environmental (missing Supabase env vars), not a code regression.
4. Public reading without login is preserved (Resource Centre routes not in middleware matcher).
5. No database, RLS, or authentication changes were made.
6. No CMS editorial write path was implemented (Track C remains blocked).

**Recommended next steps (require owner approval):**
1. Commit and push the 3 test files to the `fix/sitemap-public-data-integrity` branch.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` in Vercel Preview (staging Supabase recommended) and verify `next build` succeeds.
3. Open a PR against `main` (if repository policy requires).
4. Perform real-device mobile testing.
5. Do NOT proceed with CMS editorial workflow until security prerequisites are resolved.

---

**End of report.** No commits, pushes, merges, or deployments were made.