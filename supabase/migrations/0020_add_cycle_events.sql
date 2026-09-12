-- Cycle intelligence v1: append-only observed application-window history.
--
-- Why a table and not more columns: opens_at / last_cycle_closed_at describe
-- THE CURRENT window only. Real cycle prediction needs history ("this award
-- opened in September in each of the last three years"). cycle_events is
-- append-only observed fact with an optional source URL, so a prediction can
-- always point at what it was derived from, and admins can correct history
-- without editing derived columns.
--
-- kind values:
--   opened        application window observed open on event_date
--   closed        application window observed closed on event_date
--   deadline_set  a deadline was confirmed for the open window
--
-- Writes are admin-only (same is_admin() predicate as scholarships).
-- Reads are public: these are operational dates with no student data, and
-- keeping them public lets any future public surface (share pages) show
-- cycle context without a session.
--
-- IDEMPOTENT: IF NOT EXISTS + drop-then-create policies + not-exists-guarded
-- backfill, so re-running is harmless.
create table if not exists public.cycle_events (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  kind text not null check (kind in ('opened', 'closed', 'deadline_set')),
  event_date date not null,
  source_url text,
  note text,
  captured_by uuid references public.profiles(id) on delete set null,
  captured_at timestamptz not null default now()
);
alter table public.cycle_events enable row level security;
drop policy if exists "cycle_events_public_read" on public.cycle_events;
create policy "cycle_events_public_read"
on public.cycle_events for select using (true);
drop policy if exists "cycle_events_admin_insert" on public.cycle_events;
create policy "cycle_events_admin_insert"
on public.cycle_events for insert to authenticated
with check (is_admin(auth.uid()));
drop policy if exists "cycle_events_admin_update" on public.cycle_events;
create policy "cycle_events_admin_update"
on public.cycle_events for update to authenticated
using (is_admin(auth.uid()));
drop policy if exists "cycle_events_admin_delete" on public.cycle_events;
create policy "cycle_events_admin_delete"
on public.cycle_events for delete to authenticated
using (is_admin(auth.uid()));
create index if not exists idx_cycle_events_scholarship_date
on public.cycle_events (scholarship_id, event_date desc);
-- Backfill one 'opened' event per scholarship that already has opens_at,
-- and one 'closed' event per scholarship that already has
-- last_cycle_closed_at, so prediction has history from day one.
insert into public.cycle_events (scholarship_id, kind, event_date, note)
select s.id, 'opened', s.opens_at, 'backfilled from scholarships.opens_at'
from public.scholarships s
where s.opens_at is not null
  and not exists (
    select 1 from public.cycle_events c
    where c.scholarship_id = s.id and c.kind = 'opened' and c.event_date = s.opens_at
  );
insert into public.cycle_events (scholarship_id, kind, event_date, note)
select s.id, 'closed', s.last_cycle_closed_at, 'backfilled from scholarships.last_cycle_closed_at'
from public.scholarships s
where s.last_cycle_closed_at is not null
  and not exists (
    select 1 from public.cycle_events c
    where c.scholarship_id = s.id and c.kind = 'closed' and c.event_date = s.last_cycle_closed_at
  );
