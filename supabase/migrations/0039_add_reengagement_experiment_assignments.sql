-- Phase 0: reproducible re-engagement experiment setup.
-- This stores audience assignment metadata only; it does not send messages.
create table if not exists public.reengagement_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  treatment_ratio numeric(4,3) not null default 0.800 check (treatment_ratio > 0 and treatment_ratio < 1),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.reengagement_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.reengagement_experiments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  segment text not null check (segment in ('incomplete_onboarding', 'onboarded_inactive', 'saved_or_application_started', 'unreachable')),
  assignment_group text not null check (assignment_group in ('treatment', 'holdout')),
  email_allowed boolean not null default true,
  whatsapp_allowed boolean not null default false,
  deep_link text not null,
  next_action text not null,
  assigned_at timestamptz not null default now(),
  unique (experiment_id, profile_id)
);

alter table public.reengagement_experiments enable row level security;
alter table public.reengagement_assignments enable row level security;

drop policy if exists "reengagement_experiments_select_admin" on public.reengagement_experiments;
create policy "reengagement_experiments_select_admin" on public.reengagement_experiments
  for select using (is_admin(auth.uid()));
drop policy if exists "reengagement_experiments_insert_admin" on public.reengagement_experiments;
create policy "reengagement_experiments_insert_admin" on public.reengagement_experiments
  for insert with check (is_admin(auth.uid()));

drop policy if exists "reengagement_assignments_select_admin" on public.reengagement_assignments;
create policy "reengagement_assignments_select_admin" on public.reengagement_assignments
  for select using (is_admin(auth.uid()));
drop policy if exists "reengagement_assignments_insert_admin" on public.reengagement_assignments;
create policy "reengagement_assignments_insert_admin" on public.reengagement_assignments
  for insert with check (is_admin(auth.uid()));

create index if not exists idx_reengagement_assignments_experiment
  on public.reengagement_assignments (experiment_id, segment, assignment_group);
create index if not exists idx_reengagement_assignments_profile
  on public.reengagement_assignments (profile_id, assigned_at desc);
