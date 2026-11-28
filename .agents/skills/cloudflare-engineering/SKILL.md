---
name: cloudflare-engineering
description: Work on Scholars Cloudflare Workers and OpenNext packaging, bindings, compatibility, or deployment diagnosis. Use for runtime or deployment issues specific to this adapter.
---

Trace `next.config.js`, `open-next.config.ts`, `wrangler.jsonc`, and `wrangler.staging.jsonc`. Both Wrangler configs point to the generated OpenNext Worker and static assets. Review the staging runbook at `docs/deadline-notification-staging.md` for the documented build and dry run, and check the installed Wrangler and adapter versions against the lockfile.

Confirm the selected config, Worker identity, bindings, and downstream targets. Production and staging use different `keep_vars` settings. Inspect what a deploy would retain or replace before seeking approval. Keep probes and smoke tests free of real delivery or writes unless separately approved.

Verify packaging with the documented dry run and distinguish this from deployed runtime evidence. For approved staging checks, inspect the affected route and sanitized logs. On build or startup failure, capture the first failure and compare Node behavior with Worker compatibility and bindings. For an approved deployment regression, report evidence and confirm the rollback target before action.
