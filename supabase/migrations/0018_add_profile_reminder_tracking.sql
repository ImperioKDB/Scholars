-- Profile completion nudge tracking (feature: every-2-days reminder for
-- students whose profile isn't at 100%).
--
-- profile_reminder_last_sent_at: last time the nudge email went out.
-- profile_reminder_count: total nudges sent so far; the senders cap this
-- (PROFILE_REMINDER_MAX_SENDS, default 5) so an abandoned account is
-- never nagged indefinitely. Both the scheduled cron and the admin
-- manual button write these columns -- one shared anti-nag ledger.
--
-- Written ONLY by the service-role client (bypasses RLS) in
-- lib/email/profileNudges.ts -- no new policies needed, and no client
-- route can touch these columns.
--
-- Apply in the Supabase SQL editor (or MCP), then this file becomes the
-- reference record, per project convention. Idempotent: safe to re-run.
alter table public.profiles
add column if not exists profile_reminder_last_sent_at timestamptz,
add column if not exists profile_reminder_count integer not null default 0;
