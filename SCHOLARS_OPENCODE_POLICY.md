# Scholars OpenCode Development Policy

This policy applies to OpenCode work in the Scholars repository. It supplements, and does not replace, any future `AGENTS.md` or other repository-specific instructions.

## Before changing code

Inspect the existing implementation, routes, components, utilities, tests, database files, and deployment configuration before writing anything. Reuse established components and conventions. Prefer the smallest complete change. Do not add a dependency, abstraction, route, schema change, policy, storage bucket, or external service unless the task requires it.

Preserve unrelated user work and stop if a change could destroy data, expose credentials, or require an irreversible production decision. Never print, commit, or place secrets in reports. Never modify Supabase schema, migrations, RLS, permissions, or production deployment settings without explicit task authorization.

## Frontend and mobile quality

Preserve Scholars’ existing visual language. Use `emil-design-eng` for deliberate interaction and animation decisions, `mobile-native` for phone-specific browser behavior, and `frontend-design` only when a UI needs a distinctive visual direction. Do not create generic card grids, decorative motion, or new design tokens without a reason grounded in the product.

Build mobile-first and responsive layouts. Keep visible keyboard focus, semantic HTML, accessible names, usable hit targets, reduced-motion behavior, readable contrast, and correct loading, empty, error, and success states. Gate hover-only behavior by input capability. Test touch behavior on real hardware when the task depends on safe areas, keyboard behavior, rubber-banding, sticky hover, or gesture handling.

Use `vercel-react-best-practices` for React and Next.js performance review. Treat its rules as guidance compatible with this repository’s Next.js 14 and React 18 stack; do not upgrade the framework or React merely to follow newer examples.

## Backend and security

Keep authentication and authorization server-side. Validate all untrusted input. Preserve existing Supabase boundaries and verify RLS behavior before changing database-related code. Protect unpublished editorial content. Review grants, `SECURITY DEFINER` functions, cache behavior, and cross-user data access when relevant.

Use the `supabase` skill before any database, RLS, migration, Auth, Storage, or Postgres task. Follow the repository’s existing migration and generated-type conventions. Do not use service-role credentials in client code.

## Testing and verification

Run the narrowest relevant tests first, then the full available test suite, type checking, and a production build when the change warrants it. Use `webapp-testing` for dynamic browser verification and follow its required `with_server.py --help` check before using the helper. Use `web-design-guidelines` for accessibility and UI review; it fetches the current Vercel guidelines before each review.

For mobile or visual work, verify both narrow and wide layouts and check browser console errors. Report what was not tested. Do not claim that a skill was loaded or invoked unless the agent provides direct evidence.

## SEO and discoverability

Use `seo` for technical SEO, structured data, crawlability, internal linking, and search discoverability reviews. Preserve the existing metadata, sitemap, robots, canonical, and indexing architecture unless the task specifically changes it. Validate generated metadata from the route that serves it.

## Git and delivery

Inspect `git status` before and after every change. Keep commits focused and use conventional messages. Never force-push, delete data, or silently rewrite user work. Push only the authorized repository branch. After pushing, verify the deployment and build status when deployment access is available. Report the exact files changed, tests run, deployment result, and remaining blockers.

## Installed skills

The project uses these project-scoped skills under `.agents/skills/`:

- `emil-design-eng`
- `mobile-native`
- `frontend-design`
- `webapp-testing`
- `vercel-react-best-practices`
- `web-design-guidelines`
- `supabase`
- `seo`

Ponytail is not installed by this policy. It is an optional OpenCode plugin with always-on prompt injection and plugin code. Evaluate it separately before enabling it in `opencode.json`.
