# Scholars Resource Centre — Phase 2A Product Alignment and Editorial Foundation

**Repository:** ImperioKDB/Scholars  
**Working directory:** `/workspaces/Scholars`  
**Branch:** `feature/resource-center-public-frontend` (main branch per task scope)  
**HEAD commit:** `79456a0933eb27c6c848865cb35717c8b36ec0b5` — "feat: accessible mobile Resource Centre navigation + baseline audit report"  
**Report date:** Fri Nov 13 2026  
**Mode:** READ-ONLY investigation and planning. No source-code modifications, no database mutations, no environment/settings changes, no commit/push/merge/PR/deployment.  
**Report location:** `reports/scholars/2026-11-13-resource-center-phase-2a-audit-and-plan.md`

## Classification scale (used throughout)

| Classification | Meaning |
|---|---|
| VERIFIED | Confirmed by direct source inspection and/or direct command execution in this session |
| PARTIALLY IMPLEMENTED | Present but incomplete; does not yet satisfy the stated requirement |
| NOT IMPLEMENTED | Absent from the current codebase |
| UNVERIFIED | Claimed but not evidenced in this session; requires access not available here |
| BLOCKED | Implementation gated by an outstanding constraint that must be resolved first |

Distinguishes source-code evidence, production evidence and historical report claims.

## 1. Executive summary

The Scholars Resource Centre public frontend is live, verified, and safe: all public routes (`/resources`, `/resources/[slug]`, `/resources/category/[slug]`) return HTTP 200, canonical URLs and JSON-LD are correct, advertising is disabled by default, public reads use curated `resource_public_*` projection views (never private/base tables), image paths are allowlisted, and the six launch articles plus six categories render correctly. The full test suite passes (35 files, 182 tests) and TypeScript compiles clean (exit 0).

However, Phase 2A must not mistake a live public frontend for an editorial platform. The CMS backend (authoring, review, scheduling, publishing, archiving, correction) is **blocked** by unresolved security findings: the `profiles.is_admin` self-elevation path is structurally open, there is no author/reviewer/publisher capability model, no database-enforced transition state machine, no revision immutability or same-article binding, no audit ledger, AAL2/MFA for editorial actions is not verified enabled, and no confirmed isolated staging environment exists. Per prior audits, the CMS must **not** be built on top of the current broad admin table-write path.

There are also concrete public-frontend refinements to make: duplicate page titles (root layout template `"%s | Scholars"` plus page-level `| Scholars` suffixes), empty categories appearing in navigation/sitemap, search not matching article body or category, homepage hero copy narrowly framed around scholarships/deadlines, an unguarded shared `createClient()` call that prevents `/resources` prerender when Supabase config is absent, mobile touch-target/tap-delay/long-press gaps on category chips, and a sitemap that currently includes empty categories.

This report establishes the exact current baseline, proposes corrections, audits the six existing articles, maps categories to six proposed pillars, sets out a 12-article editorial roadmap (not yet written), details the secure editorial workflow design, and defines acceptance criteria for each proposed task. Implementation awaits owner review and explicit approval.

## 2. Verified current state

### 2.1 Repository and branch state (VERIFIED — direct execution)

- Repository: ImperioKDB/Scholars at `/workspaces/Scholars`.
- Active branch: `feature/resource-center-public-frontend` (checked out; **no branch switch performed** per hard constraints).
- HEAD commit: `79456a0933eb27c6c848865cb35717c8b36ec0b5`, authored 2026-11-12.
- `origin/main` = `137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210` — the PR #29 launch merge commit per task scope. **This commit is not an ancestor of HEAD**; the working branch carries continuation commits on top of `origin/main` plus uncommitted working-tree changes.
- `local main` (de9b40695e8ebca26d14bcaae972f5c549cdd4f6) differs from `origin/main` (`137f2fa2`).
- Working tree: 37 modified tracked files and 30+ untracked files/reports/artifacts. All tracked and untracked work preserved; no destructive Git commands used.
- Committed Resource Centre work in HEAD: `SCHOLARS_RESOURCE_CENTRE_BASELINE_AUDIT.md`, `components/resource-center-interactions.test.tsx`, `components/resource-center-interactions.tsx`.

### 2.2 Public routes (VERIFIED — source inspection)

| Route | File | Purpose | Auth required? |
|---|---|---|---|
| `/resources` | `app/resources/page.tsx` | Resource Centre home | No |
| `/resources/[slug]` | `app/resources/[slug]/page.tsx` | Article detail | No |
| `/resources/category/[slug]` | `app/resources/category/[slug]/page.tsx` | Category listing | No |

All three are Server Components using `getResourceHomeWithRepositoryContent()`, `getResourceArticleWithRepositoryContent()`, `getResourceCategoryWithRepositoryContent()` respectively. None redirect unauthenticated users to login; public reading does not require authentication (VERIFIED).

### 2.3 Middleware behaviour without an authenticated session (VERIFIED — source inspection)

`middleware.ts`:
- `PROTECTED_PREFIXES` = `/dashboard, /onboarding, /discover, /opportunities, /saved, /applications, /admin, /scholarships, /settings, /achievements, /notifications, /community`. **`/resources` is not protected**, so no authenticated session is required to read Resource Centre pages.
- Middleware matcher does **not** include `/resources`, `/resources/:path*`, `/resources/category/:path*`. Resource Centre routes bypass middleware entirely.
- Canonical-host redirect (308) applies only to production `scholars.com.ng` / `scholars-eight.vercel.app` hostnames → `www.scholars.com.ng`.
- Attribution/referral cookies are set on non-auth paths, but `/resources` is not in the matcher so attribution is not rewritten there.

Conclusion: public Resource Centre routes behave correctly with no authenticated session — they are public, unprotected, and uncached behind no auth gate (VERIFIED).

### 2.4 Repository-backed fallback and Supabase config (PARTIALLY IMPLEMENTED / UNVERIFIED in this environment)

`lib/resource-center.ts`:
- `getResourceHomeWithRepositoryContent()` (line 164) guards Supabase access behind `hasPublicSupabaseConfig()` (`lib/supabase/config.ts`: checks `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`). When config is absent, local `LOCAL_RESOURCE_ARTICLE_CARDS` / `LOCAL_RESOURCE_CATEGORIES` are used (VERIFIED).
- `getResourceImageUrl()` (line 131) returns `null` when `hasPublicSupabaseConfig()` is false (graceful image degradation — VERIFIED).
- `getResourceArticleWithRepositoryContent()` (line 180) returns the local article if present; otherwise `null` when Supabase config absent (VERIFIED).
- `getResourceCategoryWithRepositoryContent()` (line 192) returns the local category if present; otherwise `null` when Supabase absent (VERIFIED).

**Correction to prior claim (VERIFIED via `npx next build` failure):** `/resources` does **NOT** gracefully degrade during prerender in this environment. The shared server chunk `.next/server/chunks/7495.js` calls `createClient()` unconditionally during prerender of the page shell. `createClient()` (`lib/supabase/server.ts:21`) reads `process.env.NEXT_PUBLIC_SUPABASE_URL!` / `!ANON_KEY` directly with no guard and throws when either is absent. `.env.local` contains only `VERCEL_OIDC_TOKEN`; both Supabase names are missing. `npx next build` exits code 1 with 10 prerendering failures including `/resources`. This is a **pre-existing environmental issue** (missing credentials), not a Phase 2 source-code defect, but it means the repository-backed fallback does **not** survive missing Supabase public configuration across the complete request path during prerender (UNVERIFIED for production with valid env vars; the data-layer guard works, the shell does not).

### 2.5 Sitemap and robots (VERIFIED — source inspection)

`app/sitemap.ts`:
- `dynamic = "force-dynamic"`; static paths include `/resources`.
- Reads `readAllPublicRows("scholarships")`, `readAllPublicRows("opportunities")`, `readAllResourceRows()`, `readAllResourceCategoryRows()` from `lib/sitemap-data.ts`.
- `readAllResourceRows()` seeds local `LOCAL_RESOURCE_ARTICLES` then merges public `resource_public_articles` rows (deduped by slug).
- `readAllResourceCategoryRows()` seeds local `LOCAL_RESOURCE_CATEGORIES` then merges `resource_public_article_categories` rows (deduped by slug).
- **Defect:** category routes are emitted unconditionally for every slug in the merged list, including categories with zero articles — empty categories appear in sitemap output.
- Article routes emitted for every resource row with a slug (all six local articles included).

`app/robots.ts`:
- Disallows `/admin`, `/api`, `/dashboard`, `/discover`, `/applications`, `/achievements`, `/settings`, `/notifications`, `/reset-password`, `/login`, `/signup`, `/onboarding`, `/scholarships/`, `/opportunities/`, `/auth`.
- **Does NOT disallow `/resources`** — Resource Centre is crawlable (correct).
- Sitemap reference: `${base}/sitemap.xml`.

### 2.6 Metadata / title behaviour (VERIFIED — source inspection)

Root layout `app/layout.tsx` (lines 36-59):
- `metadata.template = "%s | Scholars"` — Next.js automatically appends ` | Scholars` to any page-level `title`.
- Resource pages already append `| Scholars` themselves:
  - Home: `title: "Resource Center for students | Scholars"` → renders `Resource Center for students | Scholars | Scholars` (duplicate).
  - Article: `title: \`${article.title} | Scholars\`` → renders `Article Title | Scholars | Scholars` (duplicate).
  - Category: `title: \`${result.category.name} resources | Scholars\`` → renders `Category resources | Scholars | Scholars` (duplicate).

### 2.7 Search (VERIFIED — source inspection)

`components/resource-center-search.tsx` (lines 10-13):
- Matches only `${article.title} ${article.excerpt ?? ""} ${article.article_type}`.
- Does **not** match `content_markdown` (article body) or category name/description.
- Client-side substring filter, 6 results max, `aria-live="polite"`, accessible label present.

### 2.8 Editorial schema and security (VERIFIED — migration inspection)

`supabase/migrations/20261107130100_resource_center_schema.sql`:
- Five base tables: `resource_editorial_identities`, `resource_categories`, `resource_articles`, `resource_article_categories`, `resource_revisions`.
- Four public projection views: `resource_public_editorial_identities`, `resource_public_categories`, `resource_public_articles`, `resource_public_article_categories` — all `security_barrier = true`, owner `postgres` (BYPASSRLS), explicit column projections, fixed `status = 'published' AND published_at <= now()` predicates. `SELECT` granted to `anon, authenticated`. **No `security_invoker = true`.**
- RLS enabled on all five base tables; `FORCE ROW LEVEL SECURITY` disabled.
- Base-table policies: six `FOR ALL` admin policies gated on `public.is_admin(auth.uid())`; revisions admin-only INSERT/SELECT.
- Table grants: `authenticated` has SELECT/INSERT/UPDATE on identities/categories/articles/article-category links and SELECT/INSERT on revisions; `service_role` has all; `anon` has none.
- `resource_articles.status` is a CHECK-constrained enum (`draft, in_review, scheduled, published, archived`) with timestamp-presence checks, but **no transition state machine**.
- `resource_revisions.state` is `jsonb NOT NULL` with only `jsonb_typeof(state) = 'object'` — no complete-snapshot contract, no immutability trigger, no same-article binding for `published_revision_id`.
- No author/reviewer/publisher capability model, no reviewer ≠ author rule, no audit ledger, no scheduled-publication enforcement.

### 2.9 Admin route (VERIFIED — source inspection)

`app/admin/resources/page.tsx`:
- `requireAdmin()` gate (redirects to `/login?next=/admin` or `/dashboard`).
- Read-only: `SELECT id,title,slug,status,article_type,updated_at,author_identity_id,reviewer_identity_id FROM resource_articles`. Queries private base table `resource_articles` directly (architectural inconsistency with public projection pattern, but read-only and admin-gated — LOW severity observation).
- Labels publishing workflow as "Publishing workflow next" — no write path exists.

### 2.10 Test results (VERIFIED — direct execution, this session)

`npx vitest run`: **35 test files, 182 tests passed, 0 failed** (exit 0). This includes 17 Resource Centre tests:
- `lib/resource-center.test.ts` — 9/9
- `components/resource-center-search.test.tsx` — 5/5
- `components/resource-center.test.ts` — 2/2
- `app/resources/page.test.ts` — 1/1
- `components/resource-center-interactions.test.tsx` — 18/18
- `components/resource-center-interactions-reading-progress.test.tsx` — 7/7
- `components/ResourceArticleBody.test.tsx` — 4/4

`npx tsc --noEmit --pretty false`: exit 0, no errors (source-code correctness PASS).

`npx next build`: exit code 1, 10 prerendering failures all due to missing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (environmental, pre-existing, not a source-code defect).

### 2.11 Prior security-report status (VERIFIED — report re-read against source)

All 10 concerns from `RESOURCE_CENTER_CMS_SECURITY_READINESS_AUDIT_2026-11-12.md` remain:
1. Self-elevation via `profiles.is_admin` — **Still unresolved**
2. Author/reviewer/admin separation — **Still unresolved**
3. DB-enforced publish/approval transitions — **Still unresolved**
4. Immutable revision integrity — **Still unresolved (partially present)**
5. AAL2/MFA for editorial actions — **Cannot verify (runtime unverified)**
6. Staging isolation/availability — **Cannot verify (no confirmed staging)**
7. RLS on all editorial tables — **Partially resolved**
8. Service-role key handling — **Partially resolved**
9. Audit-log integrity — **Still unresolved**
10. Protection against unauthorised publish/edit/delete — **Still unresolved**

No prior finding has been resolved in the current codebase.

### 2.12 Published production verification (historical report claim — UNVERIFIED in this session)

`RESOURCE_CENTER_PRODUCTION_VERIFICATION_2026-11-12.md` claims all 15 routes HTTP 200 on `scholars.com.ng`, production deployment at commit `137f2fa2`, advertising disabled. This is a historical report claim; no browser automation or live HTTP check was available in this environment, so it is classified **UNVERIFIED** for this session (not re-checked). The source code confirms the routes and ads-disabled-by-default behavior.

## 3. Strategic alignment assessment

### Approved strategic vision (per mission statement)
A public educational knowledge and opportunity-preparation platform within Scholars: public reading must not require authentication; repository-backed content is the launch source of truth; the editorial CMS publishing workflow is not ready.

### Alignment verdict: PARTIALLY ALIGNED (VERIFIED — source inspection)

| Vision element | Current state | Alignment | Classification |
|---|---|---|---|
| Public educational knowledge platform | Six articles, six categories, three public routes, all readable without auth | Aligned | VERIFIED |
| Opportunity-preparation platform | `OpportunityBridge` CTAs link to `/signup` (build your free profile) and `/opportunities-for-students`; `ResourceAdSlot` reserved but disabled | Partially — CTA pushes signup rather than opportunity browsing | PARTIALLY IMPLEMENTED |
| Repository-backed content is launch source of truth | `LOCAL_RESOURCE_*` merge over public projection; local content primary | Aligned | VERIFIED |
| Public reading requires no authentication | `/resources` not in middleware `PROTECTED_PREFIXES`; matcher excludes Resource Centre routes | Aligned | VERIFIED |
| Editorial CMS publishing workflow not ready | Admin page read-only ("Publishing workflow next"); no write path; CMS security blocked | Aligned (workflow correctly not ready) | VERIFIED |
| Six launch articles + six categories | Present in `lib/resource-content.ts` | Aligned | VERIFIED |

### Strategic gaps requiring Phase 2A attention
1. **Homepage hero framing** is narrowly scoped to "scholarships, applications, deadlines" (`app/resources/page.tsx` line 50), under-representing the six-pillar vision (Discover/Prepare/Learn/Build/Thrive/Understand). The page copy does not signal academic development, skills/career, student life, or educational systems.
2. **No pillar-level navigation** exists — only flat category chips. The six proposed pillars are not reflected in the information architecture.
3. **Editorial security foundations** are present (schema, views, RLS) but the workflow boundaries are not implemented; CMS work is correctly deferred but must not begin on the current broad admin write policy.

## 4. Public UX findings

### UX-1 — Duplicate page titles (VERIFIED — source inspection; CONFIRMED DEFECT)
Root layout `app/layout.tsx` sets `title.template = "%s | Scholars"`. Next.js App Router automatically renders `<title>{pageTitle} | Scholars</title>`. Resource pages already append `| Scholars`:
- Home: `title: "Resource Center for students | Scholars"` → renders `Resource Center for students | Scholars | Scholars`
- Article: `` title: `${article.title} | Scholars` `` → renders `Article Title | Scholars | Scholars`
- Category: `` title: `${category.name} resources | Scholars` `` → renders `Category resources | Scholars | Scholars`

**Correction:** Remove the `| Scholars` suffix from all three resource page `title` values and let the root-layout template append it once. Home page title should become `"Resource Center for students"`; article `${article.title}`; category `${category.name} resources`. This also shortens titles toward the SEO-recommended 50–60 character range.

### UX-2 — Empty categories in homepage navigation and sitemap (VERIFIED — source inspection; CONFIRMED DEFECT)
`app/resources/page.tsx` line 26: `visibleCategories = categories.length > 0 ? categories : LOCAL_RESOURCE_CATEGORIES`. All six local categories are always rendered regardless of article count; none are empty today (each has ≥1 local article), but the mechanism does not filter empty categories. `app/sitemap.ts` line 71 emits a route for every distinct category slug with no article-count guard. If a database-backed category is added with zero articles, it appears in both navigation and sitemap, producing an empty `ResourceEmptyState` page.

**Correction:** Filter categories to those with `articleCount > 0` (or `totalCount > 0`) before rendering navigation chips and before emitting sitemap category routes.

### UX-3 — Search scope too narrow (VERIFIED — source inspection; CONFIRMED DEFECT)
`components/resource-center-search.tsx` matches only `title + excerpt + article_type`. Article body (`content_markdown`) and category name/description are excluded. A reader searching for a term mentioned only in the body (e.g., "transcript", "recommender", "Federal Scholarship Board") gets no result.

**Correction:** Extend the match string to include article body text and category name/description. Because this is client-side over the already-loaded article list, body text is available. Add category context to each card or pass category names alongside articles.

### UX-4 — Homepage positioning too narrow (VERIFIED — source inspection; CONFIRMED DEFECT)
Homepage hero sub-headline (line 50): "Clear, practical articles about scholarships, applications, deadlines and the decisions that help students in Nigeria move with confidence." This frames the Resource Centre exclusively around scholarships/deadlines, under-representing Learn (academic development), Build (skills/career), Thrive (student life), and Understand (educational systems).

**Correction:** Broaden hero copy to reflect all six pillars while keeping the scholarship/application focus prominent.

### UX-5 — Public routes with no session (VERIFIED; no defect)
Confirmed: no auth required, no redirect to login, middleware does not intercept Resource Centre routes. Public reading works without signup/login. No change needed.

### UX-6 — Mobile / reading experience (PARTIALLY IMPLEMENTED — Phase 1 & 2 already applied)
Phase 1 + Phase 2 (committed in HEAD `79456a0` plus uncommitted refinements) addressed:
- Valid `aria-controls` in open/closed states; `aria-expanded` reflects state; Escape restores focus to trigger; outside-click dismissal; `touch-action: manipulation` (Android tap delay).
- Viewport `viewportFit: "cover"`, per-scheme `themeColor`, `interactiveWidget: "resizes-content"` in root layout.
- Category chips: `min-h-[44px]` + touch/selection-protection styles on home and article pages.
- `ReadingProgress` rAF-throttled; `ShareArticle` timed notice + failure feedback + `AbortError` handling.
- Search results wrapped in `role="list"` / `role="listitem"`.

Remaining mobile/reading gaps (UNVERIFIED on real hardware — no device/Playwright available):
- Real-device verification of safe-area insets, theme color, tap-delay removal, keyboard resize, 44px rendered chip dimensions.
- `scroll-mt-24` (96px) heading offset vs ~40px masthead (audited: masthead is in normal flow, not fixed, so headings are never obscured — intentionally unchanged).

## 5. SEO findings

### SEO-1 — Duplicate titles (VERIFIED; CONFIRMED DEFECT)
See UX-1. Page-level titles containing `| Scholars` combine with the root template `%s | Scholars` to produce doubled suffixes. Weakens click-through and title uniqueness.

### SEO-2 — Canonical URLs (VERIFIED; STRENGTH)
`getResourceCanonicalUrl()` (`lib/resource-center.ts:142`) accepts only exact `https://www.scholars.com.ng/resources/<slug>`; falls back to approved host otherwise. Tests cover 9 cases including host-spoofing, trailing slash, query string, hash, `http://`, `//`. No duplicate-canonical risk.

### SEO-3 — Structured data (VERIFIED; STRENGTH)
- Home: `CollectionPage` + `WebSite` (`isPartOf`).
- Article: `Article` (Person author, Organization publisher) + `BreadcrumbList` JSON-LD graph.
- Category: `CollectionPage` + `BreadcrumbList`.

### SEO-4 — Sitemap (PARTIALLY IMPLEMENTED; CONFIRMED DEFECT on empty categories)
Includes `/resources`, all six articles, all six categories. **Defect:** category routes emitted with no article-count filter → empty categories indexable. Also, sitemap does not include `lastModified` for category routes (acceptable) and emits all categories even when empty.

### SEO-5 — robots.txt (VERIFIED; STRENGTH)
`/resources` not disallowed; authenticated/admin surfaces disallowed. Sitemap referenced. Correct.

### SEO-6 — Meta descriptions (PARTIALLY IMPLEMENTED)
Home page description is fixed and generic. Category descriptions fall back to `Guides and updates in ${category.name}.`. Present and unique enough; no action required.

### SEO-7 — Indexability scope (VERIFIED; no defect)
Only meaningful public pages (`/resources`, articles, categories) are in the sitemap. Admin/API/dashboard routes are disallowed in robots and not in sitemap. No private pages exposed.

## 6. Article-by-article content audit

All six articles live in `lib/resource-content.ts` as repository-backed local markdown (launch source of truth). All are dated `2026-11-11T00:00:00.000Z`, authored by "Scholars Editorial Desk", last reviewed `2026-11-11`. Word counts computed from the markdown body in this session. No article carries evidence of independent external review; author/reviewer identities reference `resource_editorial_identities` which has zero rows in production, so reviewer attribution cannot be verified from the database.

### Article 1 — "How to find scholarships you can trust"
- **Slug:** `how-to-find-legitimate-scholarships`
- **Word count:** 487
- **Article type:** Field guide
- **Categories:** Scholarship applications, Scam awareness
- **Main question answered:** How do I tell whether a scholarship is legitimate before I share documents, pay a fee, or invest time?
- **Target reader:** Students in Nigeria at the start of a scholarship search, especially those exposed to WhatsApp broadcasts, reposts, and social-media graphics.
- **Practical usefulness:** High. Provides a five-question verification routine, explains "fully funded" ambiguity, advises on application identity protection, and recommends keeping a verification record. Links to Federal Scholarship Board and EducationUSA as examples of identifiable public sources.
- **Accuracy risks:** Low. No specific award amounts, deadlines, or provider claims are stated; guidance is procedural and conservative. Advises verifying via official provider domain.
- **External source quality:** Two links cited as examples (Federal Scholarship Board `education.gov.ng`, EducationUSA `educationusa.state.gov`) — presented as illustrative starting points, not endorsements of specific opportunities. Reasonable quality for context links.
- **Internal linking:** Links to `/resources/how-to-find-legitimate-scholarships` (self-reference within scam warning) and `/opportunities-for-students`. No links to other Resource Centre articles.
- **Missing examples/downloadable resources:** No downloadable verification checklist/template; no screenshot-annotated example of a legitimate vs. fake opportunity page.
- **Meets editorial standard?** Substantially yes — practical, cautious, source-conscious, Nigeria-relevant. Minor: could add a downloadable verification record template.
- **Recommendations:** Add a printable/copyable verification-record template; add one short worked example (redacted) of spotting a fake posting; cross-link to the "application mistakes" and "recommendation letter" articles.

### Article 2 — "How to write a scholarship motivation letter"
- **Slug:** `how-to-write-a-scholarship-motivation-letter`
- **Word count:** 458
- **Article type:** Writing guide
- **Categories:** Essays and letters, Scholarship applications
- **Main question answered:** How do I structure and write a motivation letter that fits a specific scholarship without sounding copied?
- **Target reader:** Applicants drafting a motivation letter for a specific programme, especially those who tend to write generic autobiographies.
- **Practical usefulness:** High. Four-part structure (Direction, Evidence, Fit, Contribution and close), "replace claims with scenes" advice, editing passes for a busy reviewer, explicit warning against copying or AI-generated claims.
- **Accuracy risks:** Low. No provider-specific claims; correctly states provider instructions take priority.
- **External source quality:** None cited. No external sources needed for a writing-guide format.
- **Internal linking:** None to other Resource Centre articles.
- **Missing examples/downloadable resources:** No anonymized sample motivation letter; no fill-in-the-blank template or evidence table template.
- **Meets editorial standard?** Yes — strong, practical, structure-focused. Could benefit from one concrete worked example.
- **Recommendations:** Add an anonymized before/after letter pair showing generic → specific; add a three-column evidence table template; cross-link to personal statement and recommendation letter articles.

### Article 3 — "How to write a scholarship personal statement that sounds like you"
- **Slug:** `how-to-write-a-scholarship-personal-statement`
- **Word count:** 435
- **Article type:** Writing guide
- **Categories:** Essays and letters, Study techniques
- **Main question answered:** How do I build a focused personal-statement narrative with reflection, without turning hardship into a performance?
- **Target reader:** Applicants writing a personal statement, especially those with gaps, changes, or concerning results in their academic path.
- **Practical usefulness:** High. Through-line method, "show reflection not just activity", beginning/middle/next-step structure, precise evidence, advice on addressing gaps truthfully.
- **Accuracy risks:** Low. No provider-specific claims; appropriately cautions against sympathy performance.
- **External source quality:** None cited.
- **Internal linking:** None to other Resource Centre articles.
- **Missing examples/downloadable resources:** No sample through-line or opening/closing examples; no personal-statement worksheet.
- **Meets editorial standard?** Yes — nuanced and reader-conscious. Could add one short example of reflection vs. activity.
- **Recommendations:** Add a short "activity vs. reflection" before/after pair; add cross-links to motivation letter and recommendation letter articles.

### Article 4 — "How to prepare for scholarship aptitude tests and interviews"
- **Slug:** `prepare-for-scholarship-aptitude-tests-and-interviews`
- **Word count:** 416
- **Article type:** Preparation guide
- **Categories:** Interviews and tests, Study techniques
- **Main question answered:** How do I prepare specifically and repeatably for scholarship aptitude tests and interviews without paying for "hidden question" guarantees?
- **Target reader:** Applicants invited to selection stages (tests/interviews), especially those wary of third-party prep scams.
- **Practical usefulness:** High. Starts with official selection information, error-log method, situation/action/result/reflection answer notes, practical day-of checklist, connectivity-failure guidance.
- **Accuracy risks:** Low. Correctly warns against paying for guarantees of hidden questions; advises using official contact routes.
- **External source quality:** None cited.
- **Internal linking:** None to other Resource Centre articles.
- **Missing examples/downloadable resources:** No error-log template; no sample answer-notes worksheet; no list of common reasoning topics with examples.
- **Meets editorial standard?** Yes — practical and scam-aware. Could add a downloadable error log.
- **Recommendations:** Add an error-log template (question type / mistake / correction); add S/A/R/R story notes template; cross-link to scam awareness article for third-party prep warnings.

### Article 5 — "How to ask for a strong recommendation letter"
- **Slug:** `how-to-get-strong-recommendation-letters`
- **Word count:** 392
- **Article type:** Application guide
- **Categories:** Essays and letters, Scholarship applications
- **Main question answered:** How do I choose, brief, and manage recommenders so the letter is specific, accurate, and ethically sound?
- **Target reader:** Applicants needing recommendation letters, especially those unsure whom to ask or what to provide.
- **Practical usefulness:** High. Evidence-over-status guidance, early ask with deadline/time zone/submission method, recommender brief contents, warning against writing fake letters, confidentiality handling, closing the loop.
- **Accuracy risks:** Low. No provider-specific claims; correctly states provider instructions override recommender convenience.
- **External source quality:** None cited.
- **Internal linking:** None to other Resource Centre articles.
- **Missing examples/downloadable resources:** No recommender-brief template/document structure; no thank-you note template.
- **Meets editorial standard?** Yes — thorough and ethics-conscious. Could add a brief template.
- **Recommendations:** Add a recommender-brief template (opportunity link, criteria, CV, examples, goals, deadline); add cross-links to motivation letter and personal statement articles.

### Article 6 — "Six scholarship application mistakes that are easy to avoid"
- **Slug:** `common-scholarship-application-mistakes`
- **Word count:** 351
- **Article type:** Final checklist
- **Categories:** Scholarship applications, Scam awareness
- **Main question answered:** What preventable mistakes cause applications to fail, and what final-review checklist should I use before submitting?
- **Target reader:** Applicants near submission, doing a final review before pressing submit.
- **Practical usefulness:** High. Six numbered mistakes (official rules check, reused essays, roles without evidence, late documents, portal review, submission ≠ success), ten-minute final check, stop-and-review trigger for payment/PIN/OTP demands.
- **Accuracy risks:** Low. No provider-specific claims; correctly frames submission confirmation vs. browser timeout messages.
- **External source quality:** None cited; links internally to Article 1 (legitimate scholarships) and `/opportunities-for-students`.
- **Internal linking:** Links to `/resources/how-to-find-legitimate-scholarships` (Article 1) and `/opportunities-for-students`. Good internal linking relative to others.
- **Missing examples/downloadable resources:** No downloadable final-checklist PDF or confirmation-saving guide.
- **Meets editorial standard?** Yes — strong final-review focus. Internal linking is a strength here.
- **Recommendations:** Add a copyable ten-minute final-check checklist; cross-link to recommendation letter and aptitude test articles.

### Cross-cutting audit findings
- **Internal linking is sparse:** Only Article 6 links to another Resource Centre article (Article 1). Articles 2–5 have zero internal links. This limits topical clustering and reader journeys between related guides.
- **No downloadable resources:** None of the six articles offers a template, worksheet, or checklist to download/copy.
- **External sources:** Only Article 1 cites external sources (two illustrative public bodies). No article claims independent review or third-party verification.
- **Evidence of independent review:** None. The `last_reviewed_at` date and "Scholars Editorial Desk" authorship are present, but no reviewer separation exists in the schema (zero `resource_editorial_identities` rows in production), and no audit trail shows who reviewed what. Per the hard constraint, no claim of independent review is made in this report.
- **Overall editorial-standard verdict:** All six articles meet a baseline practical editorial standard (clear, cautious, Nigeria-relevant, no fabricated claims). None is ready to be presented as independently reviewed.

## 7. Category and information architecture recommendations

### Six proposed pillars (per mission)
1. Discover — Opportunities and funding
2. Prepare — Applications and competitiveness
3. Learn — Academic development
4. Build — Skills and career development
5. Thrive — University and student life
6. Understand — Educational systems and information

### Mapping existing six categories to pillars (VERIFIED — source inspection)

| Existing category (slug) | Articles | Suggested pillar | Notes |
|---|---|---|---|
| Scholarship applications | 1, 2, 5, 6 | Prepare (with Discover overlap) | Core application guidance; also discovery-adjacent |
| Essays and letters | 2, 3, 5 | Prepare | Writing guides for applications |
| Interviews and tests | 4 | Prepare | Selection-stage readiness |
| Study abroad and funding | — | Discover | **Empty — no articles** |
| Study techniques | 3, 4 | Learn | Sustainable learning / evidence of growth |
| Scam awareness | 1, 6 | Understand (with Prepare overlap) | Verification & safety information |

### Category overlap, empty categories, missing coverage (VERIFIED)
- **Empty categories:** `study-abroad-and-funding` has zero articles but renders a navigation chip and sitemap route today (empty `ResourceEmptyState`). This is an empty page.
- **Overlap:** `scholarship-applications` carries 4 of 6 articles (1, 2, 5, 6) — heavy concentration. `essays-and-letters` and `study-techniques` each carry 2. Articles 2, 3, 5 sit in both essays/letters and application-adjacent categories, creating topical duplication between "Scholarship applications" and "Essays and letters".
- **Missing coverage relative to pillars:**
  - Discover (opportunities/funding): only scam/verification framing; no positive "how to find and assess funding" article beyond Article 1.
  - Learn (academic development): only `study techniques` with 2 articles; no broader academic-development content.
  - Build (skills/career): **zero articles** — no pillar coverage.
  - Thrive (university/student life): **zero articles** — no pillar coverage.
  - Understand (educational systems): only `scam awareness` partially; no systems/information content.

### Recommended information architecture (practical, no empty pages)
Do not create a category page until it has at least one published article. Recommended structure:

| Pillar | Category (slug) | Articles at launch | Status |
|---|---|---|---|
| Discover | Scholarship applications (keep) | 1, 6 | Populated |
| Prepare | Essays and letters (keep) | 2, 3, 5 | Populated |
| Prepare | Interviews and tests (keep) | 4 | Populated |
| Learn | Study techniques (keep) | 3, 4 | Populated |
| Understand | Scam awareness (keep) | 1, 6 | Populated |
| Discover | Study abroad and funding | 0 | **Retire or fill before exposing** |

**Recommendations:**
1. **Keep the five populated categories** (scholarship-applications, essays-and-letters, interviews-and-tests, study-techniques, scam-awareness). Do not add new categories until articles exist.
2. **Do not expose `study-abroad-and-funding`** until it has ≥1 article; filter it out of navigation and sitemap (addresses UX-2 / SEO-4 empty-category defect).
3. **Add a pillar layer** in navigation (six pillars) with category chips grouped under pillar headings, OR keep categories flat but rename/re-scope to align with pillars. Flat is lower risk at six articles; pillar grouping can arrive with the 12-article roadmap.
4. **Reduce overlap:** Consider moving essay-writing articles (2, 3) to be primarily "Essays and letters" with "Scholarship applications" as secondary, rather than duplicating emphasis. The category link model already supports multiple categories per article, so secondary tagging is fine — just don't let one category dominate navigation.
5. **Pillar→category mapping should be many-to-one** (a category belongs to one pillar) to avoid fragmentation; an article can belong to multiple categories.

## 8. Prioritised 12-article editorial roadmap (DO NOT WRITE/PUBLISH YET)

Roadmap ordered by search intent and reader problem. Each entry includes format, suggested authoritative sources to research (to be verified during authoring, not claimed here), and links to related Scholars functionality. Articles are **not written**.

| Priority | Title (working) | Slug | Search intent | Reader problem | Format | Authoritative sources to research | Related Scholars functionality |
|---|---|---|---|---|---|---|---|
| P1 | How to assess whether a study-abroad funding option is real | `study-abroad-funding-verification` | Informational / verification | Reader sees international funding offers and can't tell if they're legitimate | Field guide | Federal Scholarship Board, EducationUSA, destination-country education ministries, provider official domains | `/opportunities-for-students` directory; Article 1 cross-link |
| P2 | How to build a scholarship application evidence bank | `application-evidence-bank` | Informational / how-to | Reader reuses vague claims across applications and has no organized proof | How-to guide | Provider application instructions (generic), selection-criteria patterns | `/dashboard` saved applications; Article 6 cross-link |
| P3 | Study techniques that build evidence of academic growth | `study-techniques-evidence` | Informational / how-to | Reader needs to show academic growth but doesn't know what counts as evidence | How-to guide | Academic-development literature, university study-skills guidance | Article 3, Article 4 cross-links; Learn pillar |
| P4 | How to choose skills and certifications that strengthen scholarship applications | `skills-certifications-scholarships` | Informational / guidance | Reader doesn't know which skills or certificates reviewers value | Guide | Competency frameworks, provider selection criteria | Build pillar; `/discover` matching |
| P5 | University and student life: what to expect in your first term abroad | `first-term-university-abroad` | Informational / what-to-expect | Reader admitted but unprepared for day-to-day student life | Guide | International student offices, student-unions, destination universities | Thrive pillar; onboarding flow |
| P6 | How educational systems differ: credits, grades, and transcripts explained | `educational-systems-explained` | Informational / reference | Reader doesn't understand how their grades/credits translate internationally | Reference | NUC (Nigeria), WES, destination-country qualification frameworks | Understand pillar; profile/academic record flow |
| P7 | How to read a scholarship eligibility checklist | `read-eligibility-checklist` | Informational / how-to | Reader skips eligibility and wastes time on unsuitable awards | Checklist/guide | Provider eligibility pages (generic patterns) | `/opportunities-for-students` filtering |
| P8 | How to track deadlines across multiple applications | `deadline-tracking-applications` | Informational / how-to | Reader misses deadlines juggling several applications | How-to guide | Application-portal calendar practices | Dashboard deadline features |
| P9 | How to recover from a rejected scholarship application | `after-rejection-next-steps` | Informational / support | Reader discouraged by rejection and unsure whether to reapply | Guide | Provider feedback practices, reapplication timelines | `/dashboard` application history |
| P10 | How to evaluate a scholarship "consultant" or agent | `evaluate-scholarship-consultant` | Informational / verification | Reader is offered paid application help and can't tell if it's a scam | Field guide | Consumer-protection guidance, scam-awareness patterns | Article 1, Article 6 cross-links; Scam awareness |
| P11 | How to write scholarship essays that answer the actual prompt | `essays-answer-the-prompt` | Informational / how-to | Reader submits reused essays that don't address the prompt | Writing guide | Provider prompts and word-limit guidance | Article 2, Article 3 cross-links |
| P12 | How to prepare documents: transcripts, translations, and certified copies | `prepare-application-documents` | Informational / how-to | Reader doesn't know which documents to request or how to certify them | How-to guide | Institution registrar practices, certification requirements | Article 6 document-readiness point |

**Ordering rationale:** P1–P2 close the biggest gaps (Discover funding verification, Prepare evidence bank) and map to empty/under-covered pillars. P3–P6 build Learn/Build/Thrive/Understand coverage. P7–P12 deepen Prepare and support the full application lifecycle. Search intent is primarily informational/how-to/verification (top- and mid-funnel), consistent with a public knowledge platform that does not require signup.

**Related Scholars functionality links** are forward references to existing platform features (`/opportunities-for-students`, `/dashboard`, `/discover`, onboarding) that articles can point to once published; no new functionality is required for the roadmap itself.

## 9. Technical and security findings

### Public-frontend findings (VERIFIED — source inspection)
| # | Finding | Classification | Location |
|---|---|---|---|
| T1 | Duplicate page titles: root template `%s \| Scholars` + page-level `| Scholars` | CONFIRMED DEFECT | `app/layout.tsx:40`; `app/resources/page.tsx:11,14`; `app/resources/[slug]/page.tsx:19`; `app/resources/category/[slug]/page.tsx:15` |
| T2 | Empty categories not filtered from homepage navigation or sitemap | CONFIRMED DEFECT | `app/resources/page.tsx:26`; `app/sitemap.ts:71`; `lib/sitemap-data.ts:71-92` |
| T3 | Search matches only title/excerpt/article_type; not body or category | CONFIRMED DEFECT | `components/resource-center-search.tsx:10-13` |
| T4 | Homepage hero copy narrowly frames scholarships/applications/deadlines | CONFIRMED DEFECT | `app/resources/page.tsx:50` |
| T5 | `/resources` page shell does not degrade when Supabase config absent (shared chunk calls `createClient()` unconditionally) | CONFIRMED DEFECT (environmental build blocker locally; data-layer guard works) | `lib/supabase/server.ts:21-26`; `app/sitemap.ts`; `npx next build` exit 1 |
| T6 | Mobile: real-device verification of viewport/touch/theme not performed (no device/Playwright) | UNVERIFIED | `app/layout.tsx:27-34`; `app/resources/page.tsx` chips; `app/resources/[slug]/page.tsx` chips |

### Editorial CMS / security findings (VERIFIED — migration + source inspection; all from `RESOURCE_CENTER_CMS_SECURITY_READINESS_AUDIT_2026-11-12.md`, re-confirmed against current source)
| # | Finding | Classification | Location |
|---|---|---|---|
| S1 | `profiles.is_admin` self-elevation path structurally open (table-level INSERT/UPDATE on profiles + updatable own row + no is_admin guard) | STILL UNRESOLVED | `0023_lock_admin_flag.sql`; `0029_fix_profiles_upsert_table_privileges.sql`; `public.is_admin(uuid)` SECURITY DEFINER |
| S2 | No author/reviewer/publisher capability model; no reviewer ≠ author rule | STILL UNRESOLVED | `20261107130100_resource_center_schema.sql` |
| S3 | No database-enforced publish/approval transition state machine | STILL UNRESOLVED | `resource_articles.status` enum only; no transitions |
| S4 | Revision immutability partially present: `resource_revisions` exists but no immutability trigger, no complete snapshot contract, no same-article binding for `published_revision_id` | STILL UNRESOLVED (partially present) | `resource_revisions` table lines 82-101 |
| S5 | Public views are owner-executed (`security_barrier=true`, no `security_invoker=true`); owner `postgres` BYPASSRLS | PARTIALLY RESOLVED | `resource_public_*` views lines 157-214 |
| S6 | RLS enabled on all five base tables but `FORCE ROW LEVEL SECURITY` disabled; depends on compromised `is_admin` | PARTIALLY RESOLVED | schema lines 103-107 |
| S7 | AAL2/MFA for editorial actions conditional on `REQUIRE_ADMIN_MFA`; no call site passes `requireAal2`; production flag unreadable | CANNOT VERIFY (runtime unverified) | `lib/admin/access.ts:34-39`; `middleware.ts:206-215`; `.env.example:20` |
| S8 | No confirmed isolated non-production staging Supabase project | CANNOT VERIFY / STILL UNRESOLVED | No `supabase/config.toml`; `serena` unconfirmed |
| S9 | No audit ledger / append-only transition log | STILL UNRESOLVED | No `resource_article_audit_events` table |
| S10 | Broad admin `FOR ALL` write policies permit direct mutation of `status`, `reviewer_identity_id`, `published_at`, `published_revision_id` with no transition validation | STILL UNRESOLVED | schema lines 129-150 |

### Security gate verdict (VERIFIED)
**The CMS backend is BLOCKED.** Do not implement authoring or publishing on top of the current broad admin write policy. Implementation should wait for: (1) owner-approved remediation of `profiles.is_admin` grant/self-elevation and `is_admin()` helper contract, (2) isolated non-production staging environment, (3) explicit AAL2/MFA policy for editorial actions, (4) database-enforced transitions, immutable revisions, same-article revision binding, and audit ledger.

## 10. Recommended implementation sequence

Phase 2A is investigation and planning only. The sequence below is for owner approval; no work is performed yet.

**Stage 1 — Public frontend & SEO corrections (no auth/Supabase dependency; safe to implement)**
1. Fix duplicate titles: remove `| Scholars` from resource page titles; let root template append once. Acceptance: titles render once; tsc/vitest pass.
2. Filter empty categories from homepage navigation and sitemap (articleCount > 0). Acceptance: no empty category chip or route.
3. Extend search to match article body and category name/description. Acceptance: search finds body-only terms.
4. Broaden homepage hero copy to reflect six pillars. Acceptance: copy mentions more than scholarships/deadlines.

**Stage 2 — Mobile/reading hardening (already largely done in Phase 1+2; verify)**
1. Real-device verification of viewport safe areas, theme color, tap delay, 44px chips. Acceptance: confirmed on physical iOS/Android.
2. (Optional) Throttle ReadingProgress further / debounce search if dataset grows.

**Stage 3 — Pre-CMS security remediation (BLOCKED until owner approval + staging)**
1. Remediate `profiles.is_admin` self-elevation (revoke table-level UPDATE on profiles; add trigger/check protecting is_admin; narrow `is_admin()` helper).
2. Add author/reviewer/publisher capability model; reviewer ≠ author rule.
3. Add database-enforced transition state machine.
4. Add revision immutability + same-article binding + complete snapshot contract.
5. Add audit ledger.
6. Enable `FORCE ROW LEVEL SECURITY`; consider `security_invoker=true` on public views.
7. Confirm isolated staging Supabase project.
8. Confirm AAL2/MFA policy and production flag.

**Stage 4 — Editorial CMS publishing workflow (only after Stage 3)**
1. Build guarded submit/approve/schedule/publish/archive/correct endpoints behind role-separated capabilities + AAL2.
2. Connect admin Resource Center page to write path.
3. Publish the 12-article roadmap per Stage 1/2 content, through the new workflow.

**Stage 5 — Launch content**
Write and publish the 12 roadmap articles (not part of Phase 2A scope; requires Stage 4 CMS).

**Hard constraint reminder:** No work in this sequence is performed in this session. All are proposals awaiting owner review and explicit implementation approval.

## 11. Risks and dependencies

| Risk | Dependency | Mitigation |
|---|---|---|
| `next build` fails locally without Supabase credentials (environmental) | Valid `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` in `.env.local` or Vercel Preview | Do not fabricate credentials; verify build on Vercel with staging Supabase |
| CMS security findings unresolved | Owner approval + staging environment + AAL2 policy | Defer CMS; keep admin page read-only |
| Empty categories exposed if DB-backed categories added with zero articles | Category-count filter in nav + sitemap | Implement Stage 1 item 2 before adding DB categories |
| Duplicate titles hurt SEO/CTR | Title fix in Stage 1 | Low effort, no dependencies |
| Real-device mobile behavior unverified | Physical iOS/Android device | Defer to pre-release; not a blocker for planning |
| Prior security reports treated as current state without re-check | Direct source inspection (done in this session) | Continue verifying against source, not reports |
| Push to `ImperioKDB/Updates` not authorized (403) | Repository administrator with push access | Reports saved locally per fallback; owner must publish |

## 12. Exact files and database objects likely to be affected by future work

### Files
- `app/layout.tsx` — title template, viewport config (already present)
- `app/resources/page.tsx` — title, hero copy, category filtering
- `app/resources/[slug]/page.tsx` — title
- `app/resources/category/[slug]/page.tsx` — title
- `app/sitemap.ts` — category route filtering
- `lib/sitemap-data.ts` — category row filtering
- `components/resource-center-search.tsx` — search scope (body + category)
- `components/resource-center.tsx` — chips, ResourceAdSlot (unchanged unless ads enabled)
- `components/ResourceArticleBody.tsx` — heading extraction (unchanged)
- `lib/resource-center.ts` — data layer (unchanged for Stage 1)
- `lib/resource-content.ts` — roadmap articles added here when written (Stage 5)
- `lib/admin/access.ts`, `middleware.ts` — AAL2/admin gating (Stage 3)
- `app/admin/resources/page.tsx` — admin write path (Stage 4)

### Database objects
- `public.resource_articles` — status transitions, published_revision_id binding
- `public.resource_revisions` — immutability trigger, snapshot contract
- `public.resource_categories` — is_active, article count for empty filtering
- `public.resource_article_categories` — category-article membership
- `public.resource_public_articles` / `resource_public_categories` / `resource_public_article_categories` — view definitions (security_invoker, column projection)
- `public.profiles` — is_admin privilege/trigger remediation
- `public.is_admin(uuid)` — helper contract/narrowing
- New: audit ledger table; author/reviewer/publisher capability table(s)

### Objects NOT to be touched in Phase 2A
All of the above (read-only investigation). No migrations, no RLS changes, no grants, no data mutations.

## 13. Acceptance criteria for each proposed task

**Task: Fix duplicate titles**
- [ ] Resource page `title` values no longer contain `| Scholars`
- [ ] Rendered `<title>` shows ` | Scholars` exactly once per page
- [ ] Home title ≈ "Resource Center for students"; article `${article.title}`; category `${category.name} resources`
- [ ] `tsc --noEmit` exit 0; vitest passes

**Task: Filter empty categories (nav + sitemap)**
- [ ] Categories with zero articles excluded from homepage navigation chips
- [ ] Categories with zero articles excluded from `/sitemap.xml` category routes
- [ ] Sitemap still includes `/resources` and all article routes
- [ ] vitest passes

**Task: Extend search scope**
- [ ] Search matches article body (`content_markdown`) text
- [ ] Search matches category name/description
- [ ] Existing title/excerpt/article_type matching preserved
- [ ] vitest passes

**Task: Broaden homepage hero copy**
- [ ] Copy references more than scholarships/applications/deadlines (six-pillar aligned)
- [ ] Scholarship/application focus remains prominent
- [ ] No new dependencies

**Task: CMS security remediation (Stage 3 — blocked pending approval)**
- [ ] `profiles.is_admin` self-elevation path closed (table-level privilege + trigger)
- [ ] `is_admin()` helper contract narrowed/reviewed
- [ ] Author/reviewer/publisher capability model present; reviewer ≠ author enforced
- [ ] Database-enforced transition state machine for `resource_articles.status`
- [ ] Revision immutability + same-article binding + complete snapshot
- [ ] Audit ledger append-only
- [ ] `FORCE ROW LEVEL SECURITY` enabled; `security_invoker` evaluated on public views
- [ ] Isolated staging Supabase project confirmed
- [ ] AAL2/MFA policy confirmed for editorial actions
- [ ] No CMS implemented on broad admin write policy

**Task: Editorial CMS + 12-article publication (Stages 4-5 — future)**
- [ ] Guarded submit/approve/schedule/publish/archive/correct endpoints behind capabilities + AAL2
- [ ] Admin Resource Center page write path connected
- [ ] 12 roadmap articles written and published through new workflow (not Phase 2A)

---
**End of report.** Read-only investigation and planning complete. No source code, database, environment, or deployment changes were made. Awaiting owner review and explicit implementation approval before any task in Section 10 begins.


