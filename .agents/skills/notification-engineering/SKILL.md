---
name: notification-engineering
description: Change or qualify Scholars reminder, email, push, digest, broadcast, or reengagement scheduling and delivery paths.
---

Trace the affected workflow in `.github/workflows/` and `app/api/cron/` into `lib/deadlines/`, `lib/email/`, or `lib/push/`. Inspect relevant outbox and claim migrations. For deadlines, use `docs/deadline-notification-staging.md` and `docs/deadline-notification-qualification.md`.

Verify eligibility, preferences, deduplication, claim and retry behavior, and compatibility with other consumers of the outbox. Use approved isolated settings and intercepted delivery or synthetic fixtures. Apply the root approval gate to real delivery, including workflow dispatches and scripts that can send indirectly.

Check duplicate claims, bounded batches, transient failures, and status transitions. Distinguish an accepted provider response from delivery evidence. If an attempt times out or returns an ambiguous result, reconcile the outbox and provider evidence before retrying. Halt if recipient scope or delivery isolation cannot be verified.
