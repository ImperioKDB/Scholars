# Scholars provider analytics audit and implementation summary

## Current architecture before this change

Scholars already had one first-party analytics pipeline:

- Browser and server code writes to `public.events`.
- `lib/analytics.ts` sends fire-and-forget browser events to `POST /api/events`.
- `lib/analytics-server.ts` writes server-side events without blocking product actions.
- `app/api/events/route.ts` authenticates the user, rate-limits intake, validates event names and caps metadata.
- The `events_event_whitelist` database constraint is the final backstop.
- Existing admin metrics use `get_admin_metrics_summary` and the admin overview.
- Transactional tables remain canonical for saves (`saved_scholarships`) and applications (`applications`).

No parallel analytics vendor or second event table was introduced.

## Existing tracked events found in the audit

`profile_created`, `profile_completed`, `page_viewed`, `web_vital`, `client_error`, `button_clicked`, `weekly_focus_viewed`, `weekly_focus_actioned`, `onboarding_step_viewed`, `onboarding_step_completed`, `onboarding_abandoned`, `provisional_matches_viewed`, `match_viewed`, `scholarship_saved`, `scholarship_issue_reported`, `application_started`, `provider_clicked`, `application_status_changed`, `outcome_recorded`, `draft_generated`, `draft_confirmed`, `gap_nudge_clicked`, `whatsapp_opt_in`, `whatsapp_opt_out`, `community_post_created`, `community_reply_created`, `community_helpful_reaction`, and `community_reported`.

The core provider funnel was already present, but its reporting dimensions and aggregate queries were missing.

## Gaps addressed

- Signup attribution was only referral-ID based; UTM, campaign, referral-source, and ambassador dimensions were not persisted.
- Growth metrics did not have a reusable daily/WAU/MAU/returning-user report.
- Activation was present as a small admin scoreboard but not a provider-reporting dataset.
- Retention had event foundations but no cohort output for Day 1, Day 7, and Day 30.
- Demographic fields existed on profiles but were not exposed as grouped distributions.
- Scholarship funnel metrics were split across events and transactional tables with no aggregate provider report.
- CSV exports for growth, funnel, retention, and provider reports were missing.
- The admin navigation had no dedicated Provider Analytics section.

## What was added

Migration `0072_add_provider_analytics`:

- Adds `referral_source`, `campaign_id`, `ambassador_code`, `utm_source`, `utm_medium`, and `utm_campaign` to `profiles`.
- Adds attribution and reporting indexes.
- Adds the admin-only `get_provider_analytics` SQL function.
- Returns aggregate JSON for growth, activation, retention, demographics, acquisition, and scholarship funnels.
- Does not delete data, alter existing user records, or create a second event system.

Tracking:

- Middleware captures bounded campaign parameters in one HttpOnly attribution cookie.
- The existing auth callback consumes attribution once and stores it on the new profile.
- Existing `match_viewed` tracking now includes score, tier, scholarship ID, and an eligibility signal, so provider reports can count observed eligible matches without exposing profiles.

Admin/reporting:

- `/admin/analytics` provides mobile-friendly Provider Analytics cards, retention rates, demographic distributions, acquisition tables, scholarship funnel tables, and four CSV export links.
- `/api/admin/analytics` returns authenticated admin aggregate JSON or CSV downloads.
- Provider reports include eligible students (observed eligible match viewers), views, saves, application starts, provider clicks, and outcome counts.

## Data collected

Only first-party product events and existing transactional facts are used:

- Event name, timestamp, authenticated profile ID, and bounded event metadata.
- Signup attribution dimensions on the profile record.
- Profile completeness and aggregate demographic fields.
- Save rows, application rows, provider-link click events, and application status.

The report layer never selects auth email, phone numbers, full names, or raw profile records.

## Provider insights now available

For a selected reporting window, admins can answer:

- How many users registered, and how are signups trending by day?
- What are WAU, MAU, and returning-user counts?
- What share of signups completed a profile and activated within seven days?
- What are Day 1, Day 7, and Day 30 retention rates for the signup cohort?
- Which aggregate institution, discipline, level, state, and gender groups are represented?
- Which acquisition source/medium/campaign produces signups, activation, and applications?
- For each scholarship, where do observed eligible match viewers drop off between viewed, saved, application started, provider click, and outcome?

## Privacy protections

- Provider output is aggregate-only.
- API and SQL function execution are admin-gated; the function is `security definer` with an explicit `is_admin(auth.uid())` check.
- No provider endpoint returns student IDs, names, emails, phone numbers, or individual profiles.
- Attribution values are bounded at capture and grouped in reporting.
- Existing event intake remains authenticated, rate-limited, schema-validated, and metadata-capped.
- Canonical application and save tables remain separate from telemetry.

## Important measurement boundary

The current matcher evaluates profiles in the application layer and does not persist a full match snapshot. Therefore `eligible_students` in this first provider dataset means **distinct students observed in a `match_viewed` event whose recorded match tier was eligible**, not an unbounded export of all profiles that could match today. This is deliberate: it avoids a duplicate matching ledger and avoids exposing or materializing individual eligibility records. A future provider contract that requires a real-time “all currently eligible students” count should add a privacy-reviewed, aggregate match snapshot/materialized view with a minimum cohort threshold before external provider access is enabled.
