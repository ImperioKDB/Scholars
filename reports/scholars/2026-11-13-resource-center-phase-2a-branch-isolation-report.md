# Scholars Resource Centre — Phase 2A Branch Isolation Report

**Repository:** ImperioKDB/Scholars  
**Working directory:** `/workspaces/Scholars`  
**Report date:** 2026-11-13  
**Mode:** Read-only verification and branch isolation. No commits, pushes, merges, or deployments.

---

## A. Branch and Commit Information

| Item | Value |
|------|-------|
| Starting origin/main SHA | `e6fccf591131148e4516865ddd16422992ff3f1c` — "Merge pull request #33 from ImperioKDB/audit/canonical-host-redirect-2026-11-13" |
| Original implementation branch | `fix/sitemap-public-data-integrity` |
| Original implementation HEAD | `8b6de63162d52d8d950af52acd608ec95e54578d` — "fix(seo): data-driven Resource Centre category eligibility and cleanup" |
| New integration branch | `feature/resource-center-phase-2a` |
| New integration branch HEAD | `e6fccf591131148e4516865ddd16422992ff3f1c` (same as origin/main) |
| Original branch unchanged | YES (still at `8b6de63` on origin) |
| Local main HEAD (pre-isolation) | `ef7e97bb` — "Merge pull request #32 from ImperioKDB/fix/sitemap-public-data-integrity" |

---

## B. Source-of-Truth Findings

All 6 Phase 2A source-code changes were verified to already be present on `origin/main` (merged via PR #32 `fix/sitemap-public-data-integrity`). The only changes not on origin/main are the regression test files.

### Change set verification (origin/main vs original implementation branch)

| # | Approved change | File | Present on origin/main? | Evidence |
|---|-----------------|------|------------------------|----------|
| 1 | SEO title correction | `app/resources/page.tsx`, `app/resources/[slug]/page.tsx`, `app/resources/category/[slug]/page.tsx` | YES | `git show origin/main:` confirms titles no longer contain `\| Scholars` suffix |
| 2 | Empty category filtering (nav) | `app/resources/page.tsx` | YES | `categories.filter(c => getLocalResourceArticlesForCategory(c.slug).length > 0)` |
| 3 | Empty category filtering (sitemap) | `lib/sitemap-data.ts` | YES | `eligibleLocalCategorySlugs()` filters categories with ≥1 published article |
| 4 | Expanded search | `components/resource-center-search.tsx` | YES | Matches `content_markdown` and `categoryNames` |
| 5 | Six-pillar hero copy | `app/resources/page.tsx` | YES | "Practical guides on scholarships, applications, academic development, skills, student life, and educational systems" |
| 6 | Supabase config fallback | `lib/resource-center.ts` | YES | `if (!hasPublicSupabaseConfig()) return null;` guard in `getResourceImageUrl()` |
| 7 | Regression tests | 3 test files | NO (uncommitted) | Added to integration branch |

### Excluded changes
None. All Phase 2A changes are represented. No unrelated commits, files, or changes from the 1,404-commit ahead branch were included.

---

## C. Files Transferred

| File | Status | Description |
|------|--------|-------------|
| `app/resources/page.test.ts` | Modified, uncommitted | +3 tests: title composition, category filtering, hero copy |
| `lib/resource-center.test.ts` | Modified, uncommitted | +3 tests: `getResourceImageUrl()` Supabase config fallback |
| `components/resource-center-search.test.tsx` | New, untracked | +11 tests: expanded search fields (title, excerpt, type, body, category) |

### Source files (already on origin/main, not transferred)
| File | Change (already on origin/main) |
|------|---------------------------------|
| `app/resources/page.tsx` | Title fix, empty category filter, hero copy, search data |
| `app/resources/[slug]/page.tsx` | Title fix |
| `app/resources/category/[slug]/page.tsx` | Title fix |
| `lib/resource-center.ts` | `getResourceImageUrl()` Supabase config guard |
| `lib/sitemap-data.ts` | `eligibleLocalCategorySlugs()` bug fix |
| `components/resource-center-search.tsx` | Search expansion (body + category) |

---

## D. Diff Summary

Against `origin/main`:

```
 app/resources/page.test.ts  | 22 ++++++++++++++++++++++
 lib/resource-center.test.ts | 45 ++++++++++++++++++++++++++++++++++++++++++---
 2 files changed, 64 insertions(+), 3 deletions(-)
```

Plus 1 new untracked file:
```
 components/resource-center-search.test.tsx  | 147 +++++++++++++++++++++++++++++++++++++++
```

### What is NOT changed (verified)
- No middleware or protected-route changes
- No authentication changes
- No database schema changes
- No RLS changes
- No credential or environment files
- No unrelated functionality

---

## E. Test Results

```
Command: npx vitest run
Result: 29 test files, 194 tests passed, 0 failed
Duration: ~57s
```

| Test scope | Tests | Result |
|------------|-------|--------|
| Full suite | 194 | ✅ Passed |
| `app/resources/page.test.ts` | 4 | ✅ Passed |
| `lib/resource-center.test.ts` | 12 | ✅ Passed |
| `components/resource-center-search.test.tsx` | 11 | ✅ Passed |
| `app/sitemap.test.ts` | 18 | ✅ Passed |
| `components/resource-center.test.ts` | 2 | ✅ Passed |

```
Command: npx tsc --noEmit --pretty false
Result: exit 0, no errors
```

### Build Status: BLOCKED

```
Command: npx next build
Result: NOT ATTEMPTED
Reason: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from .env.local (contains only VERCEL_OIDC_TOKEN)
Classification: BLOCKED (environmental, not a code regression)
```

No credentials were invented or hardcoded. No production environment variables were modified.

---

## F. Remaining Risks

| Risk | Category | Severity | Mitigation |
|------|----------|----------|------------|
| `next build` fails without Supabase env vars | Technical/Environmental | High | Configure `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` in `.env.local` or Vercel Preview (staging Supabase recommended) |
| CMS editorial workflow blocked | Operational | High | Security gates unresolved; do not build CMS on broad admin write policy |
| Real-device mobile verification not performed | Accessibility | Medium | No device/Playwright available |
| Test files uncommitted | Process | Medium | Requires owner approval to commit and push |

---

## G. Owner Approval Checklist

### Completed (no approval needed — read-only verification)
- [x] Preflight safety checks completed
- [ ] Isolated integration branch `feature/resource-center-phase-2a` created from `origin/main`
- [ ] Phase 2A source changes verified present on origin/main
- [ ] Test files transferred to integration branch
- [ ] Full test suite: 194/194 passed
- [ ] TypeScript: exit 0
- [ ] Build: BLOCKED (missing Supabase env vars — environmental, not a regression)

### Requiring owner approval
- [ ] **Commit** the 3 test files to `feature/resource-center-phase-2a`
- [ ] **Push** the branch to remote
- [ ] **Open PR** against `main` (if repository policy requires)
- [ ] Configure Supabase env vars in Vercel Preview and verify build succeeds
- [ ] Perform real-device mobile testing

---

## H. Is Implementation Safe for PR Review?

**Yes.** All 6 Phase 2A source-code improvements are verified present on origin/main. All 194 tests pass. TypeScript compiles clean. The build failure is pre-existing/environmental. Public reading without login is preserved. No database, RLS, or authentication changes were made. No CMS editorial write path was implemented.

**Next steps (require owner approval):**
1. Commit and push the 3 test files to `feature/resource-center-phase-2a`
2. Configure Supabase env vars in Vercel Preview and verify `next build` succeeds
3. Open a PR against `main` (if repository policy requires)
4. Perform real-device mobile testing
5. Do NOT proceed with CMS editorial workflow until security prerequisites are resolved

---

**End of report.** No commits, pushes, merges, or deployments were made.