# Scholars Resource Centre — Baseline Audit

**Repository:** ImperioKDB/Scholars
**Working directory:** `/workspaces/Scholars`
**Branch:** `feature/resource-center-public-frontend`
**HEAD commit:** `c2fc789` — "fix: resource-center test file reading and sitemap local content inclusion"
**Audit date:** Thu Nov 12 2026
**Scope:** Read-only inspection. No application source files, tests, configuration, or deployment settings were modified. One new audit report was created.

---

## 1. Repository state and inspected commit

| Item | Value |
|---|---|
| Working directory | `/workspaces/Scholars` |
| Repository | ImperioKDB/Scholars |
| Branch | `feature/resource-center-public-frontend` |
| HEAD | `c2fc789` fix: resource-center test file reading and sitemap local content inclusion |
| git status | Clean tracked tree; untracked audit/report files present (see below) |
| Ignored artifacts | `.codegraph/`, `.env.local`, `.next/`, `.vercel/`, `node_modules/`, `private-backups/` |

### Untracked user work preserved (not touched)

`.agents/`, `CODEGRAPH_FRESH_SESSION_VERIFICATION_2026-11-12.md`, `CODEGRAPH_INSTALLATION_REPORT.md`, `OPENCODE_CAPABILITY_TEST.md`, `OPENCODE_STAGE_1_DEFECT_SELECTION.md`, `OPENCODE_STAGE_2_COMBOBOX_IMPLEMENTATION_REPORT.md`, `PR31_*` reports, `PR_30_REVIEW_EVIDENCE.md`, `PR_31_REVIEW_EVIDENCE.md`, `RESOURCE_CENTER_*` reports, `SCHOLARS_AUDIT_REPORT.md`, `SCHOLARS_OPENCODE_SKILLS_RUNTIME_VERIFICATION_2026-11-12.md`, `SRC UPDATES.md`, `next-env.d.ts`, `scholars-phase-2-1-8-blocker-report.md`, `skills-lock.json`.

No branches switched, no files reset/stashed/cleaned/overwritten, no commits or pushes made.

---

## 2. Skill runtime verification evidence

OpenCode's native `skill` tool was invoked for each of the seven installed skills. Instructions were loaded into context for each invocation (base directory confirmed as `.agents/skills/<name>/`).

| Skill | Discovered | Native invocation successful | Relevant guidance | Issues |
|---|---|---|---|---|
| `emil-design-eng` | Yes | Yes | Design engineering philosophy; animation decision framework; press feedback (`scale(0.97)` on `:active`); avoid `ease-in`, `scale(0)` entries, `transition: all`; respect `prefers-reduced-motion`; origin-aware popovers; CSS transitions over keyframes for dynamic UI | None |
| `frontend-design` | Yes | Yes | Distinctive visual identity over templated defaults; deliberate typography; one or two typefaces; intentional type scale; line lengths < 80 chars; non-user-triggered motion sparingly; copy as design content | None |
| `mobile-native` | Yes | Yes | Viewport meta (`viewport-fit=cover`, `interactive-widget=resizes-content`); `-webkit-tap-highlight-color: transparent`; `100dvh`/`100svh`; 16px input font size; `touch-action: manipulation`; `overscroll-behavior`; `env(safe-area-inset-*)`; `user-select: none` on controls only; per-scheme `theme-color` | None |
| `seo` | Yes | Yes | One primary intent per page; title ~50-60 chars; meta description ~120-160 chars; one H1; `Article`/`BreadcrumbList` JSON-LD; crawlability/indexability; internal linking with descriptive anchors | None |
| `vercel-react-best-practices` | Yes | Yes | 70 rules across 8 categories: eliminate waterfalls, bundle size, server performance, client data fetching, re-render, rendering, JS performance, advanced patterns | None |
| `webapp-testing` | Yes | Yes | Playwright reconnaissance-then-action pattern; `wait_for_load_state('networkidle')`; `with_server.py` helper scripts; `sync_playwright()`; headless Chromium | None |
| `web-design-guidelines` | No | No | N/A — not installed | Skill not present in `.agents/skills/` or `skills-lock.json`; `skill` tool reports "Unable to load skill web-design-guidelines" |

Six of seven skills are installed and loadable natively. Re-verified against `.agents/skills/` (directories: `emil-design-eng`, `frontend-design`, `mobile-native`, `seo`, `vercel-react-best-practices`, `webapp-testing`) and `skills-lock.json` (six entries): `web-design-guidelines` is **not installed** — its directory is absent from `.agents/skills/` and it is absent from `skills-lock.json`. The `skill` tool reports "Unable to load skill web-design-guidelines". No runtime success is claimed for it.

### Overlapping instructions and precedence

- **Mobile viewport/touch/safe areas:** `mobile-native` takes precedence (platform-layer authority; `emil-design-eng` touches touch targets only as a secondary concern).
- **Animation/motion and press feedback:** `emil-design-eng` takes precedence (deep animation decision framework; `mobile-native` defers motion to `animate` skill and focuses on platform layer).
- **Visual hierarchy/typography/layout distinctiveness:** `frontend-design` takes precedence.
- **SEO/metadata/structured data:** `seo` takes precedence.
- **React/Next.js performance and data fetching:** `vercel-react-best-practices` takes precedence.
- **Testing strategy:** `webapp-testing` takes precedence.

---

## 3. Resource Centre architecture summary

### Public routes
- `app/resources/page.tsx` — Resource Center home (server component). Reads via `getResourceHomeWithRepositoryContent()`; falls back to local content. Renders masthead frame, breadcrumbs, hero, category chips, search, featured/latest articles, `OpportunityBridge`, `ResourceAdSlot`.
- `app/resources/[slug]/page.tsx` — Article detail (server component). `generateMetadata` reads article via `getResourceArticleWithRepositoryContent()`; canonical URL via `getResourceCanonicalUrl()`. Renders `ResourcePageFrame`, `ReadingProgress` (client), `SeoJsonLd`, article header with breadcrumbs/meta/share, `ResourceArticleBody`, table of contents, author bio, category chips, related articles, CTA section.
- `app/resources/category/[slug]/page.tsx` — Category listing (server component). Metadata from `getResourceCategoryWithRepositoryContent()`. Renders featured + remaining articles, bridge, ad slot, back link.

### Shared components
- `components/resource-center.tsx` — `ResourceMasthead`, `ResourcePageFrame`, `ResourceAdSlot`, `ResourceImage`, `ResourceCard`, `ResourceEmptyState`, `ResourceErrorState`, `OpportunityBridge`.
- `components/resource-center-interactions.tsx` (`"use client"`) — `ResourceMobileNav`, `ReadingProgress`, `ArticleTableOfContents`, `ShareArticle`, `useHeadingIds`, `slugify`.
- `components/resource-center-search.tsx` (`"use client"`) — client-side fuzzy substring search over articles with `aria-live="polite"` results.
- `components/ResourceArticleBody.tsx` — markdown-ish block parser (headings/lists/quotes/paragraphs) with inline link/emphasis rendering; `extractArticleHeadings`, `safeHref`, `slugify`.

### Data layer
- `lib/resource-center.ts` — public projection reads (`resource_public_articles`, `resource_public_categories`, `resource_public_article_categories`), `ResourceDataError`, canonical URL normalization, image path allowlist (`resource-center/featured/` prefix), repository-content merge (`LOCAL_*` primary over published), `getResourceImageUrl` via Supabase Storage public URL.
- `lib/resource-content.ts` — six local categories and five local articles as markdown, plus derived card lists.
- `lib/sitemap-data.ts` — sitemap rows for resources + categories, merging local repository rows with public projection rows.

### Admin route
- `app/admin/resources/page.tsx` — read-only editorial overview (server component). `requireAdmin()` gate; reads `resource_articles` via server Supabase client; status/type/updated table. No write path.

### Tests
- `lib/resource-center.test.ts` (9), `components/ResourceArticleBody.test.tsx` (4), `components/resource-center.test.ts` (2), `app/resources/page.test.ts` (1) — all pass; 16 Resource Centre tests of 132 total.

### SEO infrastructure
- `app/sitemap.ts` (dynamic), `app/robots.ts`, `app/manifest.ts`, `components/SeoJsonLd.tsx` (`Breadcrumbs` + JSON-LD script), per-page `metadata`/`generateMetadata`.

---

## 4. Current strengths

- **Repository-safe, fail-closed data layer.** Public reads use curated `resource_public_*` projection views, never `resource_articles` or other private/base tables; canonical URLs are normalized to the approved host; image paths are allowlisted (`resource-center/featured/`, no `..`, `\`, `//`). Tests assert these contracts.
- **Repository content as launch source of truth.** Local articles/categories merge over public projection so the public MVP works without Supabase configured; sitemap includes local rows when Supabase is unavailable.
- **Existing test suite passes.** 132 tests across 25 files, including 16 Resource Centre tests covering canonical normalization, image path allowlist, pagination without duplicates, heading ID uniqueness/TOC matching, inline link safety, and eager/lazy image priority.
- **Accessibility foundations present.** `sr-only` search label, `aria-live="polite"` search results, `aria-expanded` on mobile menu and TOC toggle, `role="alert"` on error states, `:focus-visible` rings, `font-size: 16px` on inputs (prevents iOS zoom), `scroll-mt-24` on headings for sticky header offset, `aria-current="page"` on breadcrumbs.
- **Performance-conscious image handling.** `ResourceImage` uses `loading={priority ? "eager" : "lazy"}` and `fetchPriority={priority ? "high" : "auto"}`; featured image eager on cards; missing-image fallback with `aria-hidden="true"`.
- **Reduced-motion support.** `prefers-reduced-motion` disables button press transforms and page animations; `scroll-behavior: auto` under reduced motion.
- **SEO metadata present.** Page titles, descriptions, canonical alternates, OpenGraph, `CollectionPage`/`Article`/`BreadcrumbList` JSON-LD, sitemap includes `/resources` and category routes, `robots.ts` disallows `/admin` and authenticated surfaces.
- **Distinctive visual identity.** Navy/parchment/emerald palette, Fraunces display + Manrope body, emerald/amber/rose tokens darkened to meet WCAG AA (documented in tailwind config comments).

---

## 5. Confirmed defects

### D1 — Mobile nav menu: conditional rendering, no focus restoration on close, no outside-click close
**Severity:** Medium
**Evidence:** `components/resource-center-interactions.tsx` lines 7-33. The menu container is rendered only when `open` is true (`{open && (...)}` line 22), so `aria-controls="resource-mobile-menu"` on the button (line 19) references an id that does not exist in the DOM while closed. Escape closes the menu (lines 11-15) but focus is not returned to the trigger button. There is no outside-click close handler, and keyboard navigation relies on the browser's default tab order within the revealed menu.
**Why it matters:** Screen-reader users encounter a dangling `aria-controls` reference when the menu is closed; closing the menu drops focus to the document body instead of returning to the trigger, disorienting keyboard users; without outside-click close, the menu can remain open after tapping elsewhere.
**Recommended correction:** Implement a robust disclosure pattern: keep `aria-controls` valid (render the menu panel always, hidden with `hidden`/CSS, or reconcile `aria-controls` with panel presence), return focus to the menu button on close, close on Escape (already handled) and on outside click, and ensure menu links are keyboard-focusable in a logical order.
**Within approved frontend scope:** Yes.
**Relevant skill:** mobile-native (accessible menus and interactive controls).

### D2 (semantic improvement, not a confirmed defect) — Search results lack explicit list roles
**Severity:** Low (semantic improvement; no demonstrated accessibility failure)
**Evidence:** `components/resource-center-search.tsx` lines 27-33. Search matches are rendered as bare `<Link>` elements inside a `div[role="status"][aria-live="polite"]`; no `role="list"`/`role="listitem"` is present.
**Why it matters:** Adding list semantics would give screen-reader users list context (e.g., "3 items") and make the result set easier to navigate. However, the live region already announces results, and no actual accessibility failure (missing label, broken keyboard navigation, or missing required role) has been demonstrated from the current markup.
**Recommended correction:** Consider wrapping matches in `<ul role="list"><li role="listitem">` for clearer list semantics, and review whether `aria-live="polite"` remains needed once list roles are added. Treat as an enhancement, not a blocker.
**Within approved frontend scope:** Yes.
**Relevant skill:** frontend-design / mobile-native.

### D3 — `ReadingProgress` scroll listener attaches to `window` and reads `document.documentElement` on every scroll
**Severity:** Low
**Evidence:** `components/resource-center-interactions.tsx` lines 37-46. `window.addEventListener("scroll", update, { passive: true })`; `update` runs `document.documentElement.scrollHeight - window.innerHeight` on every scroll and resize.
**Why it matters:** Per-frame main-thread work on every article scroll; passive listener helps but the callback still executes on the main thread. Minor.
**Recommended correction:** Throttle/rAF the update, or compute `max` once and refresh on resize only.
**Within approved frontend scope:** Yes.
**Relevant skill:** vercel-react-best-practices (`rerender-` / rendering performance).

### D4 — Admin page queries `resource_articles` directly (private table) while public routes use projections
**Severity:** Low (architectural observation, not a user defect)
**Evidence:** `app/admin/resources/page.tsx` line 9: `supabase.from("resource_articles").select(...)`.
**Why it matters:** Inconsistent with the public projection pattern; reads author/reviewer identity IDs that are editorial metadata. Currently read-only and admin-gated, so no data exposure beyond admin.
**Recommended correction:** Keep read-only; no change required in this phase (administrative overview, not CMS). Document for the future editorial workflow phase.
**Within approved frontend scope:** Out of scope for this phase (boundary rule 3 — no CMS/write operations).
**Relevant skill:** N/A (boundary observation).

### D5 (observation) — `ResourceAdSlot` reserved placeholder when ads disabled
**Severity:** Low (observation; not a defect to remove)
**Evidence:** `components/resource-center.tsx` lines 29-36. The ad slot always renders `<aside aria-label="Advertisement">` (visible "Advertisement" text when enabled, `sr-only` "Advertisement space reserved" when disabled) occupying `my-8` space on home/category/in-article placements.
**Why it matters:** Reserving a fixed ad slot prevents cumulative layout shift (CLS) when ads load or when the ads-enabled flag toggles between deployments. Removing the placeholder could cause page content to jump when an ad is injected, harming CLS.
**Recommended correction:** Do not remove the placeholder solely to avoid an "empty" block. Assess the CLS impact first; if ads are permanently disabled, consider collapsing the slot only after confirming no layout-shift regression. No code change required in this phase.
**Within approved frontend scope:** N/A — observation only.
**Relevant skill:** vercel-react-best-practices (rendering / CLS).

---

## 6. Accessibility findings

### A1 (confirmed) — Missing `lang`/`dir` considerations for en-NG content
**Severity:** Low
**Evidence:** `app/layout.tsx` line 58 `<html lang="en">`; article dates formatted with `en-NG` locale (`lib/resource-center.tsx` line 48, `app/resources/[slug]/page.tsx` line 48).
**Why it matters:** Content is Nigerian-English but the page language is generic `en`; screen readers may use wrong pronunciation rules for dates/names.
**Recommended correction:** Consider `lang="en-NG"` if content is consistently Nigerian English; verify with screen reader.
**Within approved frontend scope:** Yes.

### A2 (confirmed) — `ShareArticle` clipboard fallback notice has no persistent status semantics beyond initial render
**Severity:** Low
**Evidence:** `components/resource-center-interactions.tsx` lines 67-77. `notice` state renders `<span role="status">` only when set; once set it remains (never cleared), and `navigator.share` errors silently set `notice=null` without announcement.
**Why it matters:** Inconsistent screen-reader feedback for share/copy outcomes.
**Recommended correction:** Use a timed live-region announcement or reset notice after a short delay.
**Within approved frontend scope:** Yes.
**Relevant skill:** mobile-native.

### A3 (confirmed) — Article headings use `scroll-mt-24` but no verification that offset matches masthead height on mobile
**Severity:** Low
**Evidence:** `components/ResourceArticleBody.tsx` lines 36-37; `ResourceMasthead` height is `py-4` plus border (approx 64px) but `scroll-mt-24` = 96px; on mobile the masthead is shorter so offset may over-compensate.
**Why it matters:** Heading targets may land with excessive offset after anchor/TOC navigation.
**Recommended correction:** Measure masthead height on mobile and align `scroll-mt` accordingly, or use `scroll-padding-top` on the scroll container.
**Within approved frontend scope:** Yes.
**Relevant skill:** mobile-native.

---

## 7. Mobile findings

### M1 (configuration) — No explicit `viewportFit: "cover"` configured
**Severity:** Low
**Evidence:** `app/layout.tsx` has no `viewport` export; a grep of `app/` finds no `viewportFit`, `themeColor`, or `interactiveWidget`. Next.js App Router auto-generates a default `<meta name="viewport" content="width=device-width, initial-scale=1">`, so a viewport IS present — it is not missing, and mobile browsers are not falling back to a 980px viewport.
**Why it matters:** The default `viewportFit` is `auto`, so iOS notch/safe-area insets (`env(safe-area-inset-*)`) resolve to `0px` and content can be letterboxed behind the notch/Dynamic Island. This matters for fixed headers, bottom bars, and safe-area padding.
**Recommended correction:** Add a `viewport` export to the root layout (`app/layout.tsx`) with `viewportFit: 'cover'` (and `interactiveWidget: 'resizes-content'` if software-keyboard resizing is desired), rather than hard-coding a meta tag.
**Within approved frontend scope:** Yes — Next.js config, no runtime behaviour change.
**Relevant skill:** mobile-native.

### M2 (configuration) — No per-scheme `theme-color` configured
**Severity:** Low
**Evidence:** No `theme-color` meta tags in layout or resource pages; `app/manifest.ts` sets `theme_color: #0B1E3D`, but no HTML `theme-color` meta overrides browser chrome; no `viewport` export with `themeColor` exists in `app/`.
**Why it matters:** Address bar/status bar color may not match the navy brand or parchment background on mobile browsers.
**Recommended correction:** Add a `viewport` export to the root layout with `themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F7F5EF' }, { media: '(prefers-color-scheme: dark)', color: '#0B1E3D' }]` rather than manually inserting duplicate `<meta name="theme-color">` tags. Next.js manages the tag and avoids duplication.
**Within approved frontend scope:** Yes.
**Relevant skill:** mobile-native.

### M3 (measurement needed) — Touch target sizes on category chips/links not directly measured
**Severity:** Low
**Evidence:** `app/resources/page.tsx` line 72 category chips `px-4 py-2.5 text-sm`; category page `app/resources/category/[slug]/page.tsx` line 49 chips `px-3 py-1.5 text-xs`. Computed CSS suggests vertical padding + text height may fall below 44px on some chips, but actual rendered dimensions were not measured in a browser (no device/browser automation available in this environment).
**Why it matters:** WCAG 2.2 / mobile-native guidance: touch targets should be at least 44×44 CSS px. Height is the more likely constraint than width for text chips.
**Recommended correction:** Measure the actual rendered touch-target height (padding + font size + line height) in a browser or with automated inspection; if below 44px, increase vertical padding (e.g., `py-3`/`py-3.5`) or add `min-h-[44px]` so the target clears 44px in height. Verify on real hardware.
**Within approved frontend scope:** Yes.
**Relevant skill:** mobile-native.

### M4 (targeted) — Long-press text selection on controls not explicitly prevented
**Severity:** Low
**Evidence:** `app/globals.css` lines 97-112 apply `:active` scale (press feedback) to all buttons globally; Resource buttons (`ShareArticle`, `ResourceCard` links, chips) use Tailwind classes with no `-webkit-user-select` / `-webkit-touch-callout` suppression.
**Why it matters:** Long-press on a control can select its label text or trigger iOS's callout on link-like controls. `user-select: none` must never be applied globally to `body` or content text (users copy addresses, error messages).
**Recommended correction:** Apply `user-select: none` / `-webkit-user-select: none` / `-webkit-touch-callout: none` only to specific button-like controls where it is appropriate (e.g., the "Share guide" button, category chips), never globally or on body/content text. Verify press feedback (`:active` scale) already covers tactile response.
**Within approved frontend scope:** Yes.
**Relevant skill:** mobile-native.

---

## 8. Performance findings

### P1 (confirmed) — `ReadingProgress` main-thread scroll listener (see D3)
**Severity:** Low
**Evidence:** `components/resource-center-interactions.tsx` lines 37-46.

### P2 (confirmed) — Client-side search re-runs filter on every keystroke over full article list (currently 5 local articles, small; scales with content)
**Severity:** Low
**Evidence:** `components/resource-center-search.tsx` lines 10-13: `useMemo` filter over `articles` array on every `normalized` change.
**Why it matters:** Fine at 5 articles; if the list grows to dozens/hundreds, per-keystroke filtering on the main thread could cause input lag.
**Recommended correction:** Debounce input or memoize with a search index; keep client-side since dataset is small and public.
**Within approved frontend scope:** Yes.
**Relevant skill:** vercel-react-best-practices (`client-`, `rerender-`).

### P3 (confirmed) — `ResourceAdSlot` always mounts an empty aside when ads disabled (see D5)
**Severity:** Low
**Evidence:** `components/resource-center.tsx` lines 29-36.

### P4 (observation) — Server components fetch data sequentially within `getResourceHome` (`Promise.all` used for articles + categories — good); `getResourceArticle` fetches article then categories then related (sequential waterfall)
**Severity:** Low
**Evidence:** `lib/resource-center.ts` lines 105-128: article fetch, then categories, then `getRelatedArticles` which paginates `resource_public_article_categories` then `readArticlesByIds`.
**Why it matters:** Sequential dependent fetches on article page add request latency; acceptable for MVP with small data.
**Recommended correction:** Consider parallelizing independent fetches where data allows.
**Within approved frontend scope:** Yes.
**Relevant skill:** vercel-react-best-practices (`async-parallel`, `server-parallel-fetching`).

---

## 9. SEO findings

### S1 (confirmed) — Canonical URL normalization is strict and correct
**Evidence:** `lib/resource-center.ts` lines 140-154; `getResourceCanonicalUrl` only accepts exact `https://www.scholars.com.ng/resources/<slug>`; falls back to approved host otherwise. Tests confirm (9 cases).
**Assessment:** Strength — no duplicate canonical risk.

### S2 (confirmed) — Structured data present on home, article, and category pages
**Evidence:** `app/resources/page.tsx` lines 30-37 (`CollectionPage`); `app/resources/[slug]/page.tsx` lines 41-46 (`Article` + `BreadcrumbList` graph); `app/resources/category/[slug]/page.tsx` lines 33-33 (`CollectionPage` + `BreadcrumbList`).
**Assessment:** Strength. `Article` schema uses `author` (Person) and `publisher` (Organization).

### S3 (confirmed) — Sitemap includes `/resources`, resource articles, and category routes
**Evidence:** `app/sitemap.ts` lines 13, 61-75; static paths include `/resources`.
**Assessment:** Strength.

### S4 (confirmed) — `robots.ts` does not disallow `/resources` (correctly crawlable)
**Evidence:** `app/robots.ts` lines 16-32 disallow list; `/resources` not present.
**Assessment:** Strength.

### S5 (observation) — Meta description on home page is generic; no per-category unique descriptions beyond category description fallback
**Severity:** Low
**Evidence:** `app/resources/page.tsx` line 12 fixed description; category page line 15 falls back to `Guides and updates in ${category.name}.`.
**Recommended correction:** Keep as-is; descriptions are present and unique enough. No action required.

---

## 10. Test coverage gaps

### T1 (confirmed gap) — No Playwright / end-to-end tests exist
**Evidence:** No `playwright.config.*`, no `*.spec.*` or e2e files found; `webapp-testing` skill installed but unused.
**Why it matters:** Interactions (mobile nav open/close, search typing + results, TOC anchor navigation, share copy) are untested at the browser level; regression risk for keyboard/screen-reader flows.
**Recommended correction:** Add Playwright coverage for Resource Center: home loads, search filters results, article TOC links navigate, mobile menu opens/closes with Escape.
**Within approved frontend scope:** Yes.
**Relevant skill:** webapp-testing.

### T2 (confirmed gap) — No tests for `ResourceSearch`, `ResourceMobileNav`, `ReadingProgress`, `ShareArticle`, `ArticleTableOfContents` client components
**Evidence:** Test files exist only for `ResourceArticleBody`, `resource-center` source-contract, `page` source-contract, and `lib/resource-center`.
**Why it matters:** Client interaction behavior (focus management, `aria-expanded`, live announcements) is unverified.
**Recommended correction:** Add vitest + @testing-library/react tests for these components.
**Within approved frontend scope:** Yes.
**Relevant skill:** webapp-testing.

### T3 (observation) — `page.test.ts` and `resource-center.test.ts` are source-grep tests (read file and assert string presence) rather than behavioral tests
**Evidence:** `app/resources/page.test.ts` reads `app/resources/page.tsx` and asserts absence of "View all"; `components/resource-center.test.ts` asserts source contains image-loading attributes.
**Why it matters:** They guard against regressions in the source contract but do not render behavior. Complementary, not sufficient alone.
**Recommended correction:** Continue adding behavioral tests; keep source-contract tests as guards.
**Within approved frontend scope:** Yes.

---

## 11. Security and architectural observations

### SEC1 — Admin page is read-only and correctly gated
**Evidence:** `app/admin/resources/page.tsx` lines 6-9: `requireAdmin()` then a `SELECT` on `resource_articles`. No write operations, no RLS changes, no credentials exposed to client.
**Assessment:** Compliant with boundary rules 1-6. The page remains an editorial overview, not a CMS (boundary rule 3 respected).

### SEC2 — Public data layer uses `resource_public_*` projections; no private tables queried
**Evidence:** `lib/resource-center.test.ts` line 88 asserts `resource_articles` not in mocked calls; `lib/supabase/public.ts` comment documents the public-client contract.
**Assessment:** Strength.

### SEC3 — Image path allowlist prevents path traversal
**Evidence:** `lib/resource-center.ts` lines 136-138 `isApprovedResourceImagePath`; tests lines 39-45.
**Assessment:** Strength.

### SEC4 — Canonical URL normalization prevents open-redirect/host-spoofing via stored canonical
**Evidence:** `lib/resource-center.ts` lines 140-154; tests lines 47-63.
**Assessment:** Strength.

### SEC5 — `NEXT_PUBLIC_RESOURCE_ADS_ENABLED` defaults false; AdSense IDs not committed
**Evidence:** `.env.example` lines 7-9; `components/resource-center.tsx` line 30 checks env.
**Assessment:** Compliant with boundary rule 6 (no production env var changes).

---

## 12. Prioritised implementation roadmap

### P0 — Critical user-facing or accessibility defects
1. **Fix mobile nav menu focus restoration and outside-click close** — D1 (return focus to trigger on close; keep `aria-controls` valid; Escape + outside-click close).

### P1 — High-value frontend improvements
2. **Configure `viewportFit: 'cover'` in the root layout** — M1 (safe-area / notch handling on iOS via Next.js `viewport` export; not a missing viewport — Next.js generates the default `width=device-width, initial-scale=1`).
3. **Add per-scheme `theme-color` via Next.js `viewport` export** — M2.
4. **Measure and, if needed, enlarge category-chip touch targets to 44×44** — M3 (verify actual rendered dimensions first; height is the likely constraint).
5. **Apply `user-select: none`/`-webkit-touch-callout: none` only to specific controls, never globally** — M4.
6. **Consider explicit list roles on search results** — D2 (semantic enhancement; optional, no demonstrated failure).
7. **Throttle `ReadingProgress` scroll listener** — D3/P1 (minor; proportional to current usage).
8. **Add Playwright E2E tests** for Resource Center interactions — T1.
9. **Add vitest + testing-library tests** for client components (`ResourceSearch`, `ResourceMobileNav`, `ReadingProgress`, `ShareArticle`, `ArticleTableOfContents`) — T2.

### P2 — Refinements and optimisation
10. **Evaluate CLS impact before changing `ResourceAdSlot` placeholder** — D5/P3 (do not remove without assessing layout-shift consequences).
11. **Debounce client-side search filtering** — P2 (minor; dataset is currently five articles).
12. **Consider parallelizing independent article-page data fetches** — P4.
13. **Review `scroll-mt-24` offset vs masthead height on mobile** — A3.
14. **Set `lang="en-NG"` if appropriate** — A1.
15. **Improve `ShareArticle` status announcement consistency** — A2.

### Deferred — Work requiring separate approval
16. **Editorial write path / CMS for admin Resource Center page** — blocked by boundary rules 3-4.
17. **Database migrations / RLS changes** — blocked by boundary rules 1-2.
18. **Authentication or permission changes** — blocked by boundary rule 4.

---

## Report location

**`/workspaces/Scholars/SCHOLARS_RESOURCE_CENTRE_BASELINE_AUDIT.md`**

This follows the existing repository convention of root-level audit/report documents (e.g., `FRONTEND_AUDIT_REPORT.md`, `SCHOLARS_AUDIT_REPORT.md`, `RESOURCE_CENTER_PRODUCTION_VERIFICATION_2026-11-12.md`).

---

## Limitations / unresolved questions

- `web-design-guidelines` skill is not installed; runtime loading could not be verified for it. Its guidance was not applied.
- Skill verification confirmed instruction loading via native `skill` invocations; no bundled scripts were executed merely to prove loading.
- Mobile findings (M1, M3, M4) were verified against code and the mobile-native skill rules, but real-device hardware verification was not performed (no device available in this environment).
- Tests were run and all 132 passed (including 16 Resource Centre tests); this observation is based on observed test output.
- No application source, test, config, or deployment file was modified, per the read-only audit constraint.

Stopping here per execution rules. Await explicit approval before implementing any recommendations.
