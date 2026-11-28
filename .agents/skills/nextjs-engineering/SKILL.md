---
name: nextjs-engineering
description: Change or diagnose Scholars Next.js App Router pages, layouts, route handlers, middleware, or server and client boundaries.
---

Trace the normal entry point under `app/`, shared UI in `components/`, and server dependencies in `lib/`. Review `middleware.ts`, `next.config.js`, and the current route's loading, error, and authentication behavior. Use the existing Vercel React best-practices skill for framework patterns.

Keep request or user-specific data out of reusable public caches. Preserve URL, redirect, and response contracts and keep service credentials in server modules. Inspect the Cloudflare skill for runtime-sensitive APIs and packaging changes.

Run relevant Vitest checks, type checking, and a Next.js build as warranted. Exercise affected routes with representative signed-out and signed-in states for auth changes. If a path works under Node but fails in Workers, capture the runtime difference and verify through the adapter workflow before calling it fixed.
