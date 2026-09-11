-- Profile completion nudge tracking (feature: every-2-days reminder for
-- students whose profile isn't at 100%).
--
-- profile_reminder_last_sent_at: last time the nudge email went out.
-- profile_reminder_count: total nudges sent so far; the cron caps this
-- (PROFILE_REMINDER_MAX_SENDS, default 5) so an abandoned account is
-- never nagged indefinitely.
--
-- Written ONLY by the service-role cron client (bypasses RLS) in
-- app/api/cron/deadline-check/route.ts, Phase 1b -- no new policies
-- needed, and no client route can touch these columns.
--
-- Apply in the Supabase SQL editor (or MCP), then this file becomes the
-- reference record, per project convention. Idempotent: safe to re-run.
alter table public.profiles
add column if not exists profile_reminder_last_sent_at timestamptz,
add column if not exists profile_reminder_count integer not null default 0;
