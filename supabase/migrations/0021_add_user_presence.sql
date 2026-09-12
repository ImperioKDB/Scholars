-- User presence tracking for the admin /users dashboard.
--
-- last_seen_at is updated by a lightweight client heartbeat
-- (POST /api/heartbeat, fired every ~60 s from the Sidebar). The admin
-- page buckets users into Active (<=5 min), Idle (5-30 min), Offline
-- (>30 min or never seen).
--
-- The handle_new_user trigger auto-creates a profiles row the moment
-- anyone signs up via Supabase Auth, so the dashboard always reflects
-- every registered account without a separate onboarding step.
--
-- IDEMPOTENT: IF NOT EXISTS + drop-then-create trigger, safe to re-run.

alter table public.profiles
add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
'Last time the client heartbeat fired for this user. Powers the Active/Idle/Offline buckets on /admin/users.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: create profile rows for any auth users who predate this
-- trigger. split_part(email, '@', 1) gives a sane default name when
-- user_metadata.full_name is missing.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
