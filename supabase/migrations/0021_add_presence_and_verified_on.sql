-- Presence + verified-on trust dates (Push E).
--
-- profiles.last_seen_at: written by POST /api/presence/heartbeat (client
-- heartbeat, ~5min + on window focus). Powers the /admin/users Active/
-- Idle/Offline board. Nullable; null = never seen since this shipped.
--
-- scholarships.last_verified_at: stamped by the admin scholarship routes
-- whenever `verified` flips true (cleared when unverified). Lets the
-- detail page say "Verified by our team on <date>" instead of an
-- undated badge, so students can judge staleness themselves.
--
-- Idempotent: safe to re-run.
alter table public.profiles
  add column if not exists last_seen_at timestamptz;
alter table public.scholarships
  add column if not exists last_verified_at timestamptz;
comment on column public.profiles.last_seen_at is
  'Last client heartbeat (presence). Written by /api/presence/heartbeat; powers the admin Active Users board.';
comment on column public.scholarships.last_verified_at is
  'When an admin last set verified=true. Null when unverified or never verified.';
create index if not exists idx_profiles_last_seen
  on public.profiles (last_seen_at desc);
