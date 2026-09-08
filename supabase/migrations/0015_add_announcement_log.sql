-- Announcement log: dedupe + throttle for new-listing digest emails.
--
-- Why not reuse notifications? notifications.scholarship_id has a FK to
-- scholarships(id), so opportunity announcements cannot live there. This
-- table keys on (profile, kind, listing_id) for BOTH kinds, and its
-- primary key gives free dedupe.
--
-- The 2-hour throttle reads max(created_at) per profile from this table
-- (see app/api/cron/deadline-check/route.ts). RLS is enabled with NO
-- policies: only the service-role cron client (which bypasses RLS) and
-- postgres itself can read or write it, which is exactly the intent.
--
-- Seed from existing notifications so scholarships already announced by
-- the old per-listing code are not re-announced by the first digest run.
--
-- IDEMPOTENT: safe to run more than once.
create table if not exists public.announcement_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_kind text not null check (listing_kind in ('scholarship', 'opportunity')),
  listing_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, listing_kind, listing_id)
);

alter table public.announcement_log enable row level security;

create index if not exists idx_announcement_log_profile_created
  on public.announcement_log (profile_id, created_at desc);

insert into public.announcement_log (profile_id, listing_kind, listing_id, created_at)
select profile_id, 'scholarship', scholarship_id, created_at
from public.notifications
where type = 'new_listing' and scholarship_id is not null
on conflict do nothing;
