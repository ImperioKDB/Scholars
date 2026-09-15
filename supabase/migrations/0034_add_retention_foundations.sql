-- Retention foundations: resumable onboarding state and student issue reports.
-- Additive only: no existing rows, tables, or data are deleted.

alter table public.profiles
  add column if not exists onboarding_step smallint not null default 0,
  add column if not exists onboarding_last_activity_at timestamptz;

create table if not exists public.scholarship_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  reason text not null check (reason in ('deadline_wrong', 'broken_link', 'closed', 'not_eligible', 'unclear', 'other')),
  details text,
  created_at timestamptz not null default now()
);

alter table public.scholarship_reports enable row level security;
drop policy if exists "scholarship_reports_insert_own" on public.scholarship_reports;
create policy "scholarship_reports_insert_own" on public.scholarship_reports
  for insert to authenticated with check (auth.uid() = profile_id);
drop policy if exists "scholarship_reports_select_own" on public.scholarship_reports;
create policy "scholarship_reports_select_own" on public.scholarship_reports
  for select to authenticated using (auth.uid() = profile_id);
drop policy if exists "scholarship_reports_select_admin" on public.scholarship_reports;
create policy "scholarship_reports_select_admin" on public.scholarship_reports
  for select using (is_admin(auth.uid()));

create index if not exists idx_scholarship_reports_created
  on public.scholarship_reports (created_at desc);
create index if not exists idx_scholarship_reports_scholarship
  on public.scholarship_reports (scholarship_id, created_at desc);
