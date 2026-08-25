-- Lightweight applications tracker (MVP scope reopened by product owner
-- 2026-08-25). Deliberately minimal vs. the full pipeline in earlier
-- mockups (no documents, no interview stage, no checklist) -- just a
-- status a student sets per scholarship they're actually pursuing,
-- separate from saved_scholarships (which represents "might apply").
--
-- Applied live via Supabase MCP on 2026-08-25. This file is a reference
-- record only, per project convention -- do not re-run against the live
-- project.

create type application_status as enum ('in_progress', 'submitted', 'accepted', 'rejected');

create table applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  status application_status not null default 'in_progress',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, scholarship_id)
);

alter table applications enable row level security;

create policy "applications_select_own" on applications
  for select using (auth.uid() = profile_id);

create policy "applications_select_admin" on applications
  for select using (is_admin(auth.uid()));

create policy "applications_insert_own" on applications
  for insert with check (auth.uid() = profile_id);

create policy "applications_update_own" on applications
  for update using (auth.uid() = profile_id);

create policy "applications_delete_own" on applications
  for delete using (auth.uid() = profile_id);

create trigger set_applications_updated_at
  before update on applications
  for each row execute function set_updated_at();
