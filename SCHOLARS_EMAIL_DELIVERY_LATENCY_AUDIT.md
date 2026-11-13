# Scholars Email Delivery Latency Audit

**Project:** Scholars (`ImperioKDB/Scholars`)  
**Production domain:** `https://scholars.com.ng`  
**Audit date:** 12 November 2026  
**Scope:** Read-only investigation and planning. No production code, Supabase settings, Brevo settings, DNS records, credentials, or deployments were changed.

## Executive summary

The available evidence does **not** establish a single current provider-latency root cause. It establishes that Scholars has two different outbound email paths:

1. Supabase Auth handles signup confirmation, confirmation resend, and password recovery. The browser calls Supabase Auth directly. The repository does not send authentication messages through its own Brevo API helper.
2. Scholars' server-side Brevo helper handles manually initiated non-authentication emails such as digests and profile nudges. The scheduled notification worker is intentionally paused.

The most important confirmed weakness is measurement. The application records a signup or resend as `accepted` when Supabase Auth returns success, but it does not record a provider message ID, Brevo delivery event, deferred state, bounce, block, spam complaint, or inbox-arrival timestamp. The admin funnel correctly warns that “accepted” is not inbox delivery. Therefore current data can show request acceptance and later account confirmation, but cannot locate time spent between Supabase handoff, Brevo processing, recipient-server acceptance, spam placement, and inbox visibility.

A second confirmed issue is configuration drift risk. The current `main` source has `OTP_LENGTH = 6` and six-digit copy, while the 10 November repository investigation records an observed eight-digit production token and a production deployment history contains commits explicitly changing OTP length. This must be resolved by checking the live Supabase Auth Email OTP length and comparing it with the deployed commit. A mismatch can make a correctly delivered token unusable, which users experience as an email/authentication failure even when delivery is fast.

The most economical strategy is to keep Supabase Auth plus Brevo for now, verify and align the OTP/template settings, obtain provider-level event evidence for controlled test messages, and add correlation and delivery-event observability before considering a migration or durable email queue. A new provider is not justified by the evidence currently available.

## What was inspected

The audit covered the public `main` branch at commit `137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210`, the current Vercel production deployment metadata, the connected production Supabase project metadata and aggregate confirmation-event data, the public production site, public DNS records, and current Supabase/Brevo documentation.

The checked-in repository contains no Brevo credential values. No secret was printed or copied into this report.

## Actual architecture and request paths

### Signup and confirmation resend

`app/(auth)/signup/page.tsx` calls `supabase.auth.signUp()` from the browser. If no session is returned, the UI enters `AuthOtp`. Verification calls `supabase.auth.verifyOtp({ email, token, type: "signup" })`. Resend calls `supabase.auth.resend({ type: "signup" })`. The browser separately sends a best-effort analytics request to `/api/auth/confirmation-email-event`.

Supabase Auth then applies its project-level email configuration and SMTP handoff. The repository does not show a custom Auth Hook or an application-side SMTP connection. The `BREVO_API_KEY` helper is a separate server-only path and is explicitly documented as not being used for authentication mail.

### Password reset

`app/reset-password/page.tsx` calls `supabase.auth.resetPasswordForEmail(cleanEmail)` from the browser, then verifies the received token with `type: "recovery"` and calls `updateUser({ password })`. The UI has a three-per-ten-minute local-browser throttle and depends on Supabase's server-side limits as the hard backstop.

### Password login and unconfirmed-account rescue

`app/(auth)/login/page.tsx` calls `signInWithPassword()`. When Supabase reports an unconfirmed email, the UI presents the same OTP component and calls `resend({ type: "signup" })` followed by `verifyOtp({ type: "signup" })`.

### Google OAuth and legacy links

Google OAuth uses `signInWithOAuth()` and `/auth/callback`, where the server exchanges the PKCE code. The callback also preserves referral attribution. The callback remains for OAuth and already-issued legacy links; the current signup and recovery UI uses OTP verification.

### Non-authentication transactional email

`lib/email/send.ts` calls `https://api.brevo.com/v3/smtp/email` only when invoked with `manual: true` and when server-only `BREVO_API_KEY` and `REMINDER_FROM_EMAIL` values exist. The scheduled email worker returns that automatic sending is intentionally disabled. This path is therefore not the direct cause of signup or password-reset email latency, but it may share sender-domain reputation or account-credit constraints if it uses the same Brevo account/domain.

## Findings

### F1 — Provider-level delivery latency is not measurable in Scholars

**Evidence:** `auth_confirmation_email_events` stores request kind, accepted/failed status, a hashed email, domain, error code, and request time. The database comment explicitly says accepted is not an inbox-delivery guarantee. The admin UI describes the same limitation. No provider message ID or Brevo webhook route was found.

**Impact:** The team cannot distinguish application request time, Supabase processing time, Brevo acceptance, deferred delivery, recipient-server acceptance, spam placement, and actual inbox arrival.

**Severity:** High. **Confidence:** Confirmed.

### F2 — Current OTP length is not proven to match live Supabase configuration

**Evidence:** The current source defines `OTP_LENGTH = 6` and renders six-digit copy. The existing 10 November investigation records an eight-digit token observed in a production reset email and says the prior production setting generated eight digits. Vercel history also includes OTP-related deployments. The connected management metadata does not expose Auth provider configuration.

**Impact:** A delivered token can be impossible to enter, causing repeated requests, expired-code reports, and apparent delivery failure.

**Severity:** Critical if the live setting is eight; Medium otherwise. **Confidence:** Probable configuration drift; live value unverified.

### F3 — Supabase Auth and application Brevo paths are separate

**Evidence:** Auth pages call Supabase Auth directly. `lib/email/send.ts` is a separate server-only Brevo API helper and says Auth confirmation and password-reset emails are sent by Supabase Auth.

**Impact:** Investigating the application Brevo API logs alone cannot explain Auth email timing. The Supabase Auth SMTP configuration and Auth logs are the first operational boundary to verify.

**Severity:** High for diagnosis. **Confidence:** Confirmed.

### F4 — Duplicate-request controls exist but are split across client and provider layers

**Evidence:** `AuthOtp` has a 60-second resend cooldown and duplicate-submit prevention. Password reset has a browser-local three-request window. Supabase documents project/user/IP limits, including a default 60-second window for signup confirmation and password recovery requests. There is no server-side Scholars idempotency record tied to an Auth request, and local storage controls are bypassable by another browser/device.

**Impact:** Repeated requests can create multiple valid-looking emails, cause users to enter an older token, consume provider credits, and worsen rate-limit or reputation pressure.

**Severity:** Medium. **Confidence:** Confirmed.

### F5 — The analytics endpoint is intentionally non-blocking but accepts client-reported status

**Evidence:** Signup and resend call `recordConfirmationEmailEvent()` with `accepted` or `failed`; the function uses `keepalive` and catches all errors. The API validates the payload and writes through a service-role client. It records what the browser reports after the Supabase SDK call; it does not independently query Auth or Brevo.

**Impact:** Useful request-funnel visibility exists, but analytics loss or client/network failure is silent. The table cannot serve as delivery truth.

**Severity:** Medium. **Confidence:** Confirmed.

### F6 — Recent production aggregate data shows accepted requests but no latency distribution

**Evidence:** A read-only aggregate query on the connected production Supabase project returned, for the last 30 days, 191 accepted requests, 14 failed signup requests, 42 accepted resends, and 58 accepted requests associated with a subsequently confirmed user. The latest recorded event was 12 November 2026 06:32 UTC.

**Impact:** The data confirms the instrumentation is receiving events and that some users confirm, but it cannot answer how long delivery took or whether unconfirmed users were delayed, bounced, spam-filtered, abandoned, or using an outdated token.

**Severity:** High. **Confidence:** Confirmed.

### F7 — Public DNS evidence is incomplete for a deliverability conclusion

**Evidence:** Public DNS returned a Brevo verification TXT record and DMARC `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` for `scholars.com.ng`. No MX record was returned for the root domain. DKIM could not be verified because the active selector was not identified from repository-safe evidence; the sender address is stored in deployment configuration, not in source.

**Impact:** The observed DMARC policy is monitoring-only, not enforcement. The records do not prove that the actual Auth sender domain has aligned SPF, DKIM, and DMARC, nor do they prove inbox placement.

**Severity:** Medium. **Confidence:** Confirmed for observed records; sender alignment unverified.

### F8 — Public production and Vercel deployment are healthy at the web layer

**Evidence:** Vercel reports the latest production deployment as `READY` at commit `137f2fa`, with the custom domains attached. The production site returns successfully through Vercel and redirects the apex to `www`.

**Impact:** There is no evidence that a general Vercel outage or failed web deployment explains email delay. This does not rule out Supabase Auth, Brevo, DNS, or recipient-side issues.

**Severity:** Low as a finding; useful exclusion. **Confidence:** Confirmed.

## Root-cause position

**Confirmed root causes:** None of the available evidence proves a current delay inside application code, Supabase, Brevo, DNS, or a recipient provider. The confirmed root cause of the investigation's lack of certainty is missing cross-system correlation and delivery-event telemetry.

**Probable contributing factor:** OTP configuration drift between the currently checked-in six-digit UI and the previously observed eight-digit production Auth configuration. This is a functional authentication defect if the live setting remains eight digits, but the live setting must be checked before calling it current.

**Unverified historical factor:** Brevo credit exhaustion and queued delivery occurred previously. No current Brevo account, quota, queue, suppression, deferred, bounce, or event export was available in the authorized integrations for this audit. It must not be treated as the present cause without current evidence.

## Bottleneck analysis

The application-to-Supabase request is a browser mutation using the Supabase SDK and a 15-second timeout wrapper. The UI does not add an artificial delay; it waits for the SDK response before showing the OTP screen. A successful response establishes only that Supabase accepted the Auth operation.

The Supabase-to-provider handoff time is not available in the repository or current aggregate table. Brevo acceptance and downstream event times are unavailable. Inbox arrival time is unavailable. Therefore the precise bottleneck location is currently **insufficiently evidenced**, not demonstrated to be in Scholars' frontend.

## Required external evidence

The following cannot be verified from the repository or read-only project metadata:

- Supabase Auth SMTP host, port/security mode, sender, active template bodies, OTP length, OTP expiry, email confirmation setting, Auth rate limits, Auth logs, and handoff errors.
- Brevo account status, remaining credits, sending restrictions, SMTP/API acceptance logs, provider message IDs, queue age, deferred messages, delivered events, bounces, blocks, suppressions, and sender/domain authentication state.
- Exact sender address and DKIM selector used by Supabase Auth.
- Controlled-recipient inbox and spam-folder arrival timestamps in Gmail and Outlook.

## Recommended economical strategy

Keep the existing Supabase Auth plus Brevo arrangement. First align the live OTP setting and templates with the deployed UI. Then run controlled tests with a fresh test account and capture a single correlation record across browser start, Supabase response, Brevo message/event ID, recipient-server event, and inbox observation. Add delivery-event ingestion only after the provider account confirms the supported webhook/API path. Consider a queue or provider migration only if measured provider data shows persistent queueing, account restrictions, or unacceptable delivery performance after configuration and sender-reputation repair.

## References

[1]: https://github.com/ImperioKDB/Scholars/tree/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210 "Scholars repository audited commit"
[2]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/app/%28auth%29/signup/page.tsx "Signup Auth flow"
[3]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/app/reset-password/page.tsx "Password recovery flow"
[4]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/lib/email/send.ts "Brevo server-side sender"
[5]: https://github.com/ImperioKDB/Scholars/blob/137f2fa28a4f1a5b1fb6eaa55e3c6c3677bb4210/supabase/migrations/0103_add_confirmation_email_analytics.sql "Confirmation request analytics schema"
[6]: https://supabase.com/docs/guides/auth/auth-smtp "Supabase custom SMTP guidance"
[7]: https://supabase.com/docs/guides/auth/auth-email-templates "Supabase Auth email templates"
[8]: https://supabase.com/docs/guides/auth/rate-limits "Supabase Auth rate limits"
[9]: https://supabase.com/kb/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw "Supabase missing Auth email troubleshooting"
[10]: https://developers.brevo.com/docs/send-a-transactional-email "Brevo transactional email events"
[11]: https://help.brevo.com/hc/en-us/articles/209435165-What-are-soft-bounces-and-hard-bounces-in-email "Brevo bounce and deferral behavior"
[12]: https://vercel.com/imperiokdbs-projects/scholars/3vSa7kRN7ir39fky5MHbaFMzAEL6 "Latest Vercel production deployment"
