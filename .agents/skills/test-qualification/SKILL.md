---
name: test-qualification
description: Qualify Scholars changes when running tests, diagnosing a failed check, reviewing assertions, or preparing verification evidence.
---

Read `package.json`, `vitest.config.js`, and `.github/workflows/ci.yml`. Vitest uses jsdom and the repository-root alias. CI uses Node 22.20.0, TypeScript checking, `npm test`, and `npm run build` with placeholder public Supabase configuration. Match that environment for CI parity where practical.

Run relevant Vitest files first, then broaden to CI checks when the change crosses boundaries. For SQL qualification, inspect `supabase/tests/` and the applicable runbook before executing anything. Review side effects before running scripts, especially `test:profile-nudge`, which invokes a trigger script.

Preserve assertions and classify failures with evidence from a baseline, an isolated reproduction, or dependency and runtime diagnostics. Record revision, command, target, exit status, and blockers. Report separately what mocks, build checks, SQL checks, and runtime smoke tests established.
