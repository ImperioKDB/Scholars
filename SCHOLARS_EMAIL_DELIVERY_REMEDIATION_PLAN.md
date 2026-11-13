# Scholars Email Delivery Remediation Plan

**Status:** Planning only. No remediation has been implemented.  
**Date:** 12 November 2026  
**Priority:** Preserve accounts and existing auth methods; repair evidence and configuration before adding complexity.

## Recommendation

Do not migrate providers or introduce a general email queue yet. The lowest-cost technically sound path is:

1. Verify the live Supabase Auth configuration and Brevo account state.
2. Align the live OTP length, templates, sender, and deployed UI.
3. Run controlled delivery tests with fresh accounts and Gmail/Outlook recipients.
4. Add minimal cross-system correlation and Brevo delivery-event ingestion.
5. Add duplicate-request and resend UX improvements only where measurements justify them.
6. Reassess provider migration only if Brevo remains the measured bottleneck after repair.

## P0 — Establish current facts and remove immediate blockers

### P0.1 Verify Auth configuration and template alignment

**Problem:** The checked-in UI is six-digit, while the prior production investigation recorded an eight-digit token. The active Supabase setting is not exposed by the available project metadata.

**Exact changes:** In Supabase Dashboard, record the current Email OTP length, OTP expiry, confirmation requirement, Auth email rate limits, SMTP host/port/security mode, sender, and the Confirm signup and Reset password template bodies. Confirm OTP templates use `{{ .Token }}` as visible text when the UI uses `verifyOtp`; do not use `{{ .Token }}` as an `href`.

**Affected services:** Supabase Auth dashboard, deployed `AuthOtp`, signup, login rescue, and reset-password flows.

**Dependencies:** Supabase project administrator access; a designated test mailbox.

**Security:** Do not export SMTP passwords or API keys. Do not disable email confirmation or rate limits. Redact tokens and recipient addresses in evidence.

**Regression risks:** Changing OTP length invalidates existing tokens. Template changes can break legacy link users or redirects if performed broadly.

**Tests:** Fresh signup OTP, confirmation resend, unconfirmed login rescue, recovery OTP, invalid/reused/expired OTP, normal password login, Google OAuth, and legacy link compatibility.

**Expected improvement:** Eliminates unusable-token failures and distinguishes delivery failures from UI/configuration failures.

**Cost:** No incremental software cost; operator time only.

**Acceptance criteria:** The live OTP length and deployed UI agree; both current templates render the expected token; controlled tests can verify signup and recovery without copy/paste ambiguity.

### P0.2 Check Brevo account and exact message events

**Problem:** Historical credit exhaustion is known, but current credits, restrictions, queue, suppression, and delivery states are unverified.

**Exact changes:** For controlled test messages, export the Brevo event timeline containing message ID, accepted/sent time, delivered/deferred/bounce/blocked/spam status, recipient-server response, and final state. Check account credits, daily/hourly quotas, sender verification, suppression/blocklists, and transactional sending status.

**Affected services:** Brevo dashboard/API; Supabase Auth SMTP integration.

**Dependencies:** Brevo account administrator access and a fresh test message.

**Security:** Export only redacted event metadata. Never place API keys in the repository or report.

**Regression risks:** Sending uncontrolled tests can consume credits or affect reputation.

**Tests:** One controlled test per flow and recipient provider; no bulk sends.

**Expected improvement:** Identifies whether delay occurs before Brevo, in Brevo, or after handoff.

**Cost:** Existing plan; controlled tests consume a small number of credits.

**Acceptance criteria:** Each test has a provider message ID and a terminal event or an explicitly documented pending state.

## P1 — Repair confirmed significant weaknesses

### P1.1 Resolve OTP source/configuration drift

**Problem:** Source, historical report, and deployment history disagree on six versus eight digits.

**Exact changes:** Choose one product requirement. If six digits is required, set Supabase Auth to six and keep the six-digit UI. If eight digits is the intended live behavior, update the shared constant and all copy/tests to eight. Change only after recording the current value and invalidate/replace controlled test tokens.

**Affected files/services:** `lib/auth/otp-input.ts`, `components/AuthOtp.tsx`, `app/reset-password/page.tsx`, tests, Supabase Auth provider settings.

**Dependencies:** P0.1 and explicit product decision if the intended length is not already documented.

**Security:** Keep Supabase responsible for generation, expiry, single-use verification, and rate limiting.

**Regression risks:** Existing tokens and any email template text can become invalid or misleading.

**Tests:** Exact-length input, paste/autofill, wrong code, expired code, reused code, resend cooldown, and both signup/recovery types.

**Expected improvement:** Removes a class of false delivery failures.

**Cost:** No provider cost; one small repository change if needed.

**Acceptance criteria:** One source of truth governs UI, copy, tests, and the live Auth setting.

### P1.2 Validate sender-domain authentication

**Problem:** Public DNS showed Brevo verification and DMARC monitoring, but the actual Auth sender and DKIM selector are not known.

**Exact changes:** Identify the exact sender used by Supabase Auth and verify SPF, DKIM, and DMARC alignment for that domain. Keep authentication mail on a focused sender/subdomain. Decide whether DMARC should move from `p=none` only after aggregate reports and bounce/spam data support enforcement.

**Affected services:** DNS, Brevo sender/domain settings, Supabase Auth SMTP settings.

**Dependencies:** Brevo and DNS access.

**Security:** Preserve a monitored rollback path. Do not publish secrets in DNS or reports.

**Regression risks:** Incorrect SPF/DKIM changes can reduce delivery immediately.

**Tests:** DNS lookup from multiple resolvers, Brevo verification, Gmail/Outlook controlled delivery, alignment checks.

**Expected improvement:** Better sender trust and fewer spam, rejection, or deferred outcomes.

**Cost:** Usually no incremental cost; DNS/provider account plan dependent.

**Acceptance criteria:** SPF and DKIM pass for the actual sender, DMARC alignment is measured, and test messages reach both controlled providers.

## P2 — Reliability and performance improvements

### P2.1 Add cross-system delivery correlation

**Problem:** Scholars records only an accepted/failed request and later confirmation, not provider delivery.

**Exact changes:** Add a non-secret correlation ID to the request analytics record and structured logs. Where Supabase/Brevo supports it, retain the provider message ID and timestamps for `requested`, `auth_accepted`, `provider_sent`, `provider_delivered`, `deferred`, `bounced`, `blocked`, and `spam`. Add a secured webhook endpoint or scheduled reconciliation job only after provider payload requirements are confirmed.

**Affected files/services:** `app/api/auth/confirmation-email-event/route.ts`, analytics migration, admin analytics page, Brevo webhooks/API, optionally Supabase Auth Hook configuration.

**Dependencies:** P0.2; schema review; decision on retention and webhook authentication.

**Security:** Hash or tokenize recipient identity; verify webhook signatures; do not log OTPs, full email addresses, passwords, or SMTP credentials; apply retention limits and RLS.

**Regression risks:** Bad webhook verification or provider retries could create duplicate events. Analytics failures must remain non-blocking.

**Tests:** Signed/unsigned webhook, replay, duplicate provider event, malformed payload, provider timeout, database outage, and redaction tests.

**Expected improvement:** Makes p50/p95 handoff and delivery latency measurable and alerts actionable.

**Cost:** Small repository/database effort; Brevo webhook capability generally included, subject to account plan.

**Acceptance criteria:** A controlled message can be traced end to end without exposing secrets, and duplicate events are idempotent.

### P2.2 Improve duplicate-request and resend behavior

**Problem:** Client cooldowns are bypassable and users can request multiple codes across devices or tabs.

**Exact changes:** Keep Supabase limits as the authority. Add a server-side request-intent record or edge guard only if measurement shows abuse or duplicate volume; include email hash, purpose, time bucket, correlation ID, and outcome, not the OTP. Make the UI clearly state that the newest code supersedes older codes and show the last request state without claiming delivery.

**Affected files/services:** Auth UI, analytics schema/API, Upstash rate limiting if a server guard is added.

**Dependencies:** P2.1 metrics; security review.

**Security:** Avoid account enumeration; use purpose-specific limits; do not disable provider controls.

**Regression risks:** Over-throttling can block legitimate recovery. Cross-device behavior must remain understandable.

**Tests:** Two tabs, two devices, rapid resend, concurrent signup, browser storage cleared, provider 429, and newest-token-only behavior.

**Expected improvement:** Fewer duplicate messages, stale-token attempts, and wasted credits.

**Cost:** Small repository effort; existing Upstash plan may suffice.

**Acceptance criteria:** Duplicate requests are reduced without weakening Supabase protections or revealing whether an address exists.

## P3 — Monitoring and long-term optimization

### P3.1 Define delivery SLOs and alerts

Track application request processing, Auth handoff acceptance, provider acceptance, provider delivery, terminal failure, confirmation completion, and observed inbox arrival separately. Use the proposed targets as goals, not guarantees: request processing under one second where practical; provider acceptance under two seconds where practical; 95% delivered within 30 seconds and 99% within 60 seconds for controlled/provider-observed messages.

Alert on exhausted credits, provider rejection spikes, deferred queue age, webhook failure, rising hard bounces, rising spam complaints, OTP mismatch reports, and falling confirmation rate. The confirmation rate is a diagnostic signal, not a delivery metric.

### P3.2 Reassess queue or provider migration only from measured evidence

A durable queue is justified only if measured provider handoff or rate limits require smoothing, retries, or reconciliation. Auth messages should not be placed in an application queue that generates or stores tokens; Supabase Auth must remain responsible for token security. If migration is considered later, compare Brevo with alternatives on Nigerian recipient deliverability, SMTP/Auth compatibility, free-tier limits, sender authentication, webhooks, support, and projected cost using controlled tests rather than marketing claims.

## Testing strategy

Use designated test accounts and controlled Gmail and Outlook recipients. Record timestamps in UTC for browser request start, browser response, Auth log handoff, provider message acceptance, provider delivery/defer/bounce event, recipient-server acceptance where available, and inbox/spam observation.

Run registration, resend, OTP login/rescue, password reset, expired-token, wrong-token, reused-token, concurrent-request, duplicate-submit, provider-timeout, provider-rejection, Supabase 429, and Redis/unavailable-observability tests. Verify Google OAuth, normal password login, protected-route session persistence, and legacy callback behavior after every Auth template or OTP configuration change.

Never send bulk or uncontrolled messages to real users. Use one fresh address per clean signup test, remove test accounts according to the approved retention process, and redact all addresses and tokens from logs and reports.

## Repository-only versus external work

Repository-only work includes correlation fields, provider-event ingestion, idempotent event storage, dashboard metrics, structured logging, UI copy/cooldown improvements, tests, and alerts that consume existing signals.

External access is required for Supabase Auth OTP/template/rate-limit/SMTP settings, Brevo account/credits/events/webhooks/suppressions, DNS SPF/DKIM/DMARC, and controlled mailbox observation. No repository change can prove those external states by itself.

## References

[1]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/lib/auth/otp-input.ts "OTP length source"
[2]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/components/AuthOtp.tsx "Shared OTP UI"
[3]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/lib/auth/confirmation-email-analytics.ts "Confirmation analytics client"
[4]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/supabase/migrations/0103_add_confirmation_email_analytics.sql "Confirmation analytics schema"
[5]: https://supabase.com/docs/guides/auth/auth-smtp "Supabase custom SMTP"
[6]: https://supabase.com/docs/guides/auth/auth-email-templates "Supabase Auth email templates"
[7]: https://supabase.com/docs/guides/auth/rate-limits "Supabase Auth rate limits"
[8]: https://developers.brevo.com/docs/send-a-transactional-email "Brevo delivery events and webhooks"
[9]: https://help.brevo.com/hc/en-us/articles/209435165-What-are-soft-bounces-and-hard-bounces-in-email "Brevo deferral and bounce behavior"
