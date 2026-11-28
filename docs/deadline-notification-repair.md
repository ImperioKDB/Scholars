# Deadline notification repair

Prepared on `fix/deadline-notification-system` from `main` at `9abc41d`. PR #47 restored a daily scheduler, but its deadline path selected one exact UTC date and required a push-enabled account before it could write to the inbox. It ignored in-progress applications and could notify students who had already submitted. Push retries could replay an old intent after a correction. The older email worker and Inngest handlers were paused, and the outbox had no deadline email quota or per-channel lifecycle.

## What changed

The existing GitHub Actions workflow calls `/api/cron/deadline-check` hourly. Its 09:17 WAT run still performs the daily new-match push and admin expiry checks. The deadline engine uses the existing notification inbox, outbox, application tracker, saved lists and device subscriptions. It selects verified, open listings that a student saved or has an in-progress application for. A submitted, accepted or rejected application overrides a save. Other matches remain outside deadline targeting because the existing settings provide no eligible-match deadline opt-in.

Date-only deadlines include the entire listed day in Africa/Lagos. The default stages are:

| Window starts | In-app | Push | Email |
| --- | --- | --- | --- |
| Seven calendar days before the deadline date | Yes | — | Yes |
| Three calendar days before the deadline date | Yes | Yes | — |
| Midnight at the start of the deadline date | Yes | Yes | Yes |
| Noon on the deadline date | Yes | Yes | — |
| Midnight following the deadline date | Yes | — | Off by default |

A late scheduler run processes the current window. It skips older windows, and the passed window expires after 24 hours. The engine rechecks the deadline, listing availability, application state, saved state and channel preferences when claiming queued work. A corrected date gets a new dedupe key. Push expires by the application cutoff. The Settings page gives each deadline channel its own switch. In-app reminders default on, push defaults on for already enabled devices, and email requires the student's opt-in and a confirmed email address.

Inbox writes and their ledger entries commit together. Outbound rows have atomic leases and a dedupe key per recipient, listing, date, stage and channel. A claim can combine up to 12 listings at the same stage for one student. Push uses existing Expo and browser subscriptions, up to five devices of each type per deadline bundle, and prunes expired devices. A permanent failure ends the attempt. Temporary push errors and explicit Mailtrap rate-limit rejections can retry up to three attempts while the current window is valid. A worker interrupted after sending push can still cause a duplicate on retry because the provider cannot share the database transaction. Ambiguous Mailtrap results or interrupted email leases become **unknown** and are never retried.

Quota reservations are atomic and count individual Mailtrap API requests, including attempts that fail or have an unknown result. Daily and monthly windows use UTC. Where eligible work competes for available capacity, the 24-hour stage gets first claim. Mailtrap API success is **accepted**. With optional Email Logs credentials, the hourly workflow checks matching provider message IDs and records **delivered**, **bounced**, **failed** or **suppressed** when confirmed. This confirms provider delivery to the receiving mail server. Inbox writes are **delivered** when committed. Push receipt verification remains with the device providers. The admin Health check shows discovery time, queued intents, delivery states, retries and email quota usage.

## Changed files

| Area | Files |
| --- | --- |
| Database | `supabase/migrations/20261127000000_complete_deadline_reminders.sql` |
| Scheduler and cron | `.github/workflows/digest-cron.yml`, `app/api/cron/deadline-check/route.ts` |
| Deadline and push delivery | `lib/deadlines/{engine,mailtrap,mailtrapReceipts,policy}.ts`, `lib/push/{campaigns,deliver,send}.ts`. Removed unused `lib/email/deadlineRemindersQueue.ts` |
| UI and profile preferences | `app/settings/page.tsx`, `app/api/profile/route.ts`, `components/DeadlineNotificationSettings.tsx`, `app/api/notifications/route.ts`, `components/{NotificationBell,NotificationInbox}.tsx`, `app/admin/health/page.tsx` |
| Deadline labels and links | `lib/dates.ts`, `app/opportunities/[id]/{page,OpportunityDetailClient}.tsx` |
| Configuration and verification | `.env.example`, `lib/dates.test.ts`, `lib/deadlines/{engine,mailtrap,mailtrapReceipts}.test.ts`, `app/api/cron/deadline-check/route.test.ts`, `scripts/test-deadline-reminders.sh`, `supabase/tests/deadline_reminders{,_fixture}.sql` |

## Runtime configuration

| Location | Variables |
| --- | --- |
| Worker and GitHub Actions secret | `CRON_SECRET` must match on both sides |
| GitHub Actions repository variable | `APP_URL`, the canonical HTTPS application base URL. The scheduler rejects redirects. |
| Worker, existing Supabase settings | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The existing app also uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| Worker, existing browser push settings | `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, optional `WEB_PUSH_SUBJECT` |
| Worker, optional timing overrides | `DEADLINE_REMINDER_DAYS=7`, `DEADLINE_PUSH_REMINDER_DAYS=3`. The first must be between 2 and 30, and the second must be earlier than the first. |
| Worker, required to enable Mailtrap | `DEADLINE_EMAIL_ENABLED=true`, `MAILTRAP_API_TOKEN` as a Worker secret, `DEADLINE_FROM_EMAIL`, and a canonical HTTPS `NEXT_PUBLIC_APP_URL` for email links. |
| Worker, optional email settings | `DEADLINE_FROM_NAME=Scholars`, `DEADLINE_EMAIL_DAILY_LIMIT=140`, `DEADLINE_EMAIL_MONTHLY_LIMIT=3800`, `DEADLINE_PASSED_EMAIL_ENABLED=false`. Daily and monthly caps can be lowered to zero and cannot exceed 150 and 4,000. |
| Worker, optional delivery confirmation | `MAILTRAP_ACCOUNT_ID` and `MAILTRAP_LOG_API_TOKEN` with Email Logs read access. |

## Mailtrap and scheduler activation

1. In Mailtrap Email API/SMTP, add the sending domain and publish the DNS records Mailtrap provides. Wait for domain verification. Use an address on that domain for `DEADLINE_FROM_EMAIL`.
2. Set the `NEXT_PUBLIC_*` variables at build time. Create a token with send access to that domain's **Transactional** stream. Bind it securely as `MAILTRAP_API_TOKEN`. The integration posts to `https://send.api.mailtrap.io/api/send`. For restricted Worker egress, allow `send.api.mailtrap.io`. To reconcile accepted messages, provide the account ID and read-scoped token and allow `mailtrap.io` for Email Logs. Confirm availability in the existing Mailtrap plan. The existing Brevo and Resend workflows keep their current configuration. [Official Mailtrap documentation](https://docs.mailtrap.io/) · [Mailtrap's official API client](https://github.com/mailtrap/mailtrap-nodejs)
3. Follow the [final qualification and staging sequence](deadline-notification-qualification.md) for the POST scheduler contract, validation, and rollback.

## Validation

- TypeScript and the complete Vitest suite passed on Node 22.20.0. All 293 tests in 47 files passed.
- `bash scripts/test-deadline-reminders.sh` passed in disposable PostgreSQL 16, including concurrent inbox generation, exclusive push claims and atomic email quota reservation.
- Workflow YAML, shell syntax and mocked dispatch passed, including independent email and receipt processing after an HTTP 503 from push.
- The OpenNext production build and Wrangler dry run passed. A local Cloudflare Worker returned HTTP 401 without cron authorization, HTTP 400 for an invalid authorized task and HTTP 200 for disabled receipt processing.
- Provider calls in tests were mocked. No live notifications were sent, and no staging or production database was changed.
