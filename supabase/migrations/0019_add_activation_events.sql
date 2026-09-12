-- Activation measurement + WhatsApp consent capture (Phase 1).
--
-- events: append-only product analytics. Only a server-whitelisted set of
-- event names can be inserted, enforced BOTH here (check constraint, the
-- backstop) and in app/api/events/route.ts (zod enum, the first gate), so
-- this table can never become a dump of arbitrary client strings.
--   profile_created / profile_completed are written server-side by
--   POST /api/profile (only the server knows the before/after state).
--   provisional_matches_viewed / gap_nudge_clicked / whatsapp_opt_in /
--   whatsapp_opt_out are written by the client via POST /api/events.
--
-- WhatsApp columns: consent + number captured now; the actual WhatsApp
-- lifecycle (Phase 3) reads these. Opt-in is explicit and revocable, and
-- nothing is sent over WhatsApp until Phase 3 ships.
--
-- Apply in the Supabase SQL editor, then this file becomes the reference
-- record per project convention. Idempotent: safe to re-run.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint events_event_whitelist check (
    event in (
      'profile_created',
      'profile_completed',
      'provisional_matches_viewed',
      'gap_nudge_clicked',
      'whatsapp_opt_in',
      'whatsapp_opt_out'
    )
  )
);
alter table public.events enable row level security;
drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own" on public.events
for insert to authenticated
with check (auth.uid() = profile_id);
drop policy if exists "events_select_admin" on public.events;
create policy "events_select_admin" on public.events
for select using (is_admin(auth.uid()));
create index if not exists idx_events_event_created
  on public.events (event, created_at desc);
create index if not exists idx_events_profile_created
  on public.events (profile_id, created_at desc);
alter table public.profiles
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_number text;
comment on column public.profiles.whatsapp_opt_in is
  'Explicit, revocable consent for WhatsApp reminders (Phase 3). Nothing is sent until that phase ships.';
