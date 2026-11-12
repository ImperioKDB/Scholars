# Scholars OpenCode Skills Audit and Handoff

**Repository:** `ImperioKDB/Scholars`  
**Audited revision:** `767287b9aadc6e8f01ffe6bde8497ae956bd0dd7`  
**Audit date:** 2026-11-12

## Repository inspection

The checkout is clean on `main`, tracking `origin/main`. The repository uses Next.js App Router conventions, Next.js `14.2.35`, React `18.3.1`, Tailwind CSS `3.4.x`, TypeScript `5.5.x`, Vitest `2.1.x`, Supabase SSR/client packages, and npm with `package-lock.json`. Existing quality tooling includes Vitest and the repository’s test scripts. No `AGENTS.md`, `opencode.json`, `opencode.jsonc`, `.opencode/`, or pre-existing `.agents/skills/` directory existed before this task. No application source, database schema, RLS policy, Supabase permission, or deployment setting was changed.

## Installed skills

The Skills CLI installed eight project-scoped skills with `--agent opencode --copy`. Its actual OpenCode-compatible location is `.agents/skills/`, not `.opencode/skills/`. `skills list --json --agent opencode` reports every item as `scope: project`, `status: tracked`, and `universal: OpenCode` was reported during installation.

| Rank | Skill | Publisher and source | Purpose | Compatibility | Security and overlap | Score | Recommendation |
|---:|---|---|---|---|---|---:|---|
| 1 | `vercel-react-best-practices` | Vercel, [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React and Next.js performance patterns with referenced rules | Compatible as guidance for Next.js 14 / React 18; ignore upgrade-only examples | Markdown plus referenced rule files; no executable files; complements existing stack | 93 | Install |
| 2 | `supabase` | Supabase, [supabase/agent-skills](https://github.com/supabase/agent-skills) | Supabase Auth, Postgres, RLS, Storage, MCP, and migration safety | Directly relevant to the existing Supabase architecture | Contains operational instructions and links to external Supabase docs; no executable files; must not be used to make unapproved schema changes | 92 | Install |
| 3 | `webapp-testing` | Anthropic, [anthropics/skills](https://github.com/anthropics/skills) | Playwright-based browser testing and screenshots | Compatible with the existing web app; repository currently has no Playwright dependency, so use only when the task authorizes adding/using it | Includes `scripts/with_server.py` and examples; installer reported 1 Socket/Snyk alert and Medium Snyk risk; run helper only after reviewing `--help` | 87 | Install with review |
| 4 | `emil-design-eng` | Emil Kowalski, [emilkowalski/skills](https://github.com/emilkowalski/skills) | Deliberate UI motion, interaction, CSS, and component polish | Compatible with Tailwind 3, React 18, and the existing UI | Markdown only; complements product design work | 88 | Install |
| 5 | `mobile-native` | Emil Kowalski, [emilkowalski/skills](https://github.com/emilkowalski/skills) | Mobile browser behavior, touch, safe areas, viewport units, and real-device checks | Highly relevant to the mobile-first product and PWA-like surfaces | Markdown only; complements `emil-design-eng` without duplicating its motion focus | 90 | Install |
| 6 | `frontend-design` | Anthropic, [anthropics/skills](https://github.com/anthropics/skills) | Distinctive visual direction and accessible responsive UI | Compatible when constrained to the existing Scholars design system | Markdown plus license; overlaps with Emil on visual quality, but provides useful design-planning discipline | 82 | Install |
| 7 | `web-design-guidelines` | Vercel, [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | UI and accessibility review against current Web Interface Guidelines | Compatible; it fetches current guidelines at review time | Markdown only, but performs a documented external fetch when invoked; complementary to frontend skills | 86 | Install |
| 8 | `seo` | Affaan Mustafa, [affaan-m/ECC](https://github.com/affaan-m/ECC) | Technical SEO, structured data, indexing, and discoverability | Relevant to existing sitemap/robots/metadata infrastructure | Markdown only; narrower and more task-specific than the core engineering skills | 78 | Install |
| 9 | Ponytail | Dietrich Gebert, [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | Minimal-change engineering, review/audit commands, and always-on ruleset injection | OpenCode support is documented, but local OpenCode v2.2.7 is unavailable for verification | Real plugin code and lifecycle behavior; injects rules every turn; adds commands; requires an `opencode.json` plugin entry or package installation | 74 | Optional; not installed |
| 10 | `supabase-postgres-best-practices` | Supabase, [supabase/agent-skills](https://github.com/supabase/agent-skills) | Deep Postgres query/schema/RLS performance guidance | Compatible, but narrower than the installed `supabase` skill | Markdown/reference-heavy and overlaps with the installed Supabase guidance; add when database work becomes a recurring focus | 76 | Optional |

The original requested Vercel name `react-best-practices` maps to the current Skills CLI name `vercel-react-best-practices`; installing the former produced a no-match error, so no ambiguous package was substituted.

Exact project-level commands for the installed set are:

```bash
npx skills@latest add emilkowalski/skills --skill emil-design-eng --agent opencode --copy --yes
npx skills@latest add emilkowalski/skills --skill mobile-native --agent opencode --copy --yes
npx skills@latest add anthropics/skills --skill frontend-design --agent opencode --copy --yes
npx skills@latest add anthropics/skills --skill webapp-testing --agent opencode --copy --yes
npx skills@latest add vercel-labs/agent-skills --skill vercel-react-best-practices --agent opencode --copy --yes
npx skills@latest add vercel-labs/agent-skills --skill web-design-guidelines --agent opencode --copy --yes
npx skills@latest add supabase/agent-skills --skill supabase --agent opencode --copy --yes
npx skills@latest add affaan-m/ECC --skill seo --agent opencode --copy --yes
```

## Installation evidence

Installed paths:

- `.agents/skills/emil-design-eng/SKILL.md`
- `.agents/skills/mobile-native/SKILL.md`
- `.agents/skills/frontend-design/SKILL.md`
- `.agents/skills/webapp-testing/SKILL.md`
- `.agents/skills/vercel-react-best-practices/SKILL.md` plus its `rules/` files
- `.agents/skills/web-design-guidelines/SKILL.md`
- `.agents/skills/supabase/SKILL.md` plus its documented references/assets
- `.agents/skills/seo/SKILL.md`
- `skills-lock.json`, which records each GitHub source, source path, content hash, and copy install mode

The exact installation pattern used was:

```bash
npx skills@latest add <owner>/<repo> --skill <skill-name> --agent opencode --copy --yes
```

No global installation was performed. No existing configuration was overwritten. The new policy is a distinct file, `SCHOLARS_OPENCODE_POLICY.md`, because no `AGENTS.md` existed.

## Verification status

| Skill | Installed | Discoverable by Skills CLI | Loaded by OpenCode | Invoked successfully |
|---|---|---|---|---|
| All eight installed skills | Yes | Yes; `skills list --json --agent opencode` returned `status: tracked` | Not verified | Not verified |

The sandbox does not contain an `opencode` executable, so it is not possible to prove a fresh OpenCode v2.2.7 session loaded or invoked the skills. The evidence proves project installation and Skills CLI discoverability only. A manual verification remains: open a new OpenCode v2.2.7 session in this checkout, list or inspect available skills, and invoke one skill in a harmless read-only request.

There are no duplicate skill directories. The only executable file in the installed tree is Anthropic’s documented `.agents/skills/webapp-testing/scripts/with_server.py`; it was not executed. The other installed assets are Markdown, text, or reference files.

## Ponytail decision

Ponytail is an official OpenCode plugin, not merely a Markdown skill. Its official OpenCode instructions support `opencode plugin add @dietrichgebert/ponytail` or a project `opencode.json` entry such as `{"plugins":["@dietrichgebert/ponytail"]}`. The official documentation says the plugin injects the ruleset every turn and adds `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, and `/ponytail-help`. The repository also contains plugin code and lifecycle-related assets.

It was classified Optional rather than installed because the local OpenCode executable is absent, the project had no plugin configuration to preserve, and always-on prompt/plugin behavior is a materially broader change than installing a project skill. If enabled later, make a backup of any existing OpenCode config, inspect the proposed JSON diff, add only the plugin entry, start a fresh session, and verify the plugin commands. Install only from `DietrichGebert/ponytail` or `@dietrichgebert/ponytail`.

## Compatibility constraints

The repository is Next.js 14 / React 18, not Next.js 16 / React 19. Installed skills are instruction files and do not change framework versions, but future OpenCode work must treat examples requiring newer versions as non-authoritative until compatibility is checked. Do not add Playwright, Framer Motion, or other dependencies solely because a skill mentions them. The existing Vitest setup remains the default unit-test path.

The `supabase` skill must be used before database, RLS, migration, Auth, Storage, or Postgres changes, but this task intentionally made none of those changes. The `web-design-guidelines` skill fetches the current Vercel guideline document when invoked. The `webapp-testing` skill’s helper must be run with `--help` before use, as required by its own instructions.

## Validation and blockers

After installing the locked dependencies with `npm ci`, the existing test suite passed: **25 test files and 132 tests passed**. The production build was also attempted. It reached static-page generation but failed because the sandbox has no project Supabase environment variables; the existing application attempts to create Supabase clients during prerendering and reports missing project URL/API configuration on routes including `/`, `/login`, `/signup`, `/resources`, and legal/auth pages. No credentials were printed or created during this validation.

No Vercel deployment was triggered because this task explicitly forbids production deployment changes and only prepares OpenCode skills and policy. No Supabase connection or schema operation was needed. The remaining manual blocker is OpenCode runtime verification.

## Resource Centre readiness

During Resource Centre work, use the policy and installed skills in this order: inspect the current route/component/data flow; use `frontend-design`, Emil’s skills, and `mobile-native` for UI planning and touch behavior; use `vercel-react-best-practices` for compatible React/Next.js implementation review; use `supabase` for Auth, editorial data, RLS, Storage, or migrations; use `seo` for route metadata, structured data, sitemap, and indexing; use `webapp-testing` for browser regression checks; and use `web-design-guidelines` for a final accessibility/UI review. Keep each task scoped, run the repository’s tests and build when dependencies are available, and report evidence rather than inferring that a skill was loaded or invoked.

## References

[1]: https://github.com/emilkowalski/skills "Emil Kowalski skills repository"
[2]: https://github.com/anthropics/skills "Anthropic Agent Skills repository"
[3]: https://github.com/vercel-labs/agent-skills "Vercel Agent Skills repository"
[4]: https://github.com/supabase/agent-skills "Supabase Agent Skills repository"
[5]: https://github.com/affaan-m/ECC "Affaan Mustafa ECC repository"
[6]: https://github.com/DietrichGebert/ponytail "Dietrich Gebert Ponytail repository"
[7]: https://raw.githubusercontent.com/DietrichGebert/ponytail/main/INSTALL.md "Ponytail installation instructions"
[8]: https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md "Vercel Web Design Guidelines skill"
[9]: https://raw.githubusercontent.com/supabase/agent-skills/main/skills/supabase/SKILL.md "Supabase skill instructions"
