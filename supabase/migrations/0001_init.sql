-- ScholarSync — initial schema
--
-- SUPERSEDED — kept for reference only. The live Supabase project
-- (scholarship-platform, cmdglabohpttgfofcmqc) already has a schema applied
-- directly via its own migrations (0001_init, 0002_harden_functions) that
-- differs from this file in real ways: it adds a profiles.is_admin column,
-- gates admin writes to scholarships/scholarship_rules via an
-- is_admin(auth.uid()) RLS check (no service-role key needed from API
-- routes), and includes a profiles_insert_own policy this file doesn't have.
-- Do NOT run this file against that project — it would fight the real
-- policies. If you spin up a fresh Supabase project later, treat this as a
-- starting point to adapt, not a drop-in script.

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────
do $$ begin
  create type academic_level as enum ('undergrad', 'postgrad');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scholarship_level as enum ('undergrad', 'postgrad', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rule_operator as enum ('eq', 'gte', 'lte', 'in', 'exists');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('deadline_reminder', 'new_match');
exception when duplicate_object then null; end $$;

-- ── profiles ────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  academic_level academic_level,
  discipline text,
  gpa numeric,
  nationality text,
  gender text,
  financial_need boolean not null default false,
  career_goals text,
  profile_completeness int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── scholarships ────────────────────────────────────────────
create table if not exists scholarships (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider_name text not null,
  description text,
  amount text,
  deadline date,
  application_url text,
  level scholarship_level not null default 'both',
  discipline text,
  verified boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── scholarship_rules ───────────────────────────────────────
create table if not exists scholarship_rules (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  field text not null,
  operator rule_operator not null,
  value jsonb not null
);

-- ── saved_scholarships ──────────────────────────────────────
create table if not exists saved_scholarships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (profile_id, scholarship_id)
);

-- ── notifications ───────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  scholarship_id uuid references scholarships(id) on delete set null,
  type notification_type not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── profile_completeness trigger ───────────────────────────
-- Weighted so the fields that matter most for matching count for more.
create or replace function compute_profile_completeness(p profiles)
returns int
language plpgsql
immutable
as $$
declare
  score int := 0;
begin
  if p.full_name is not null and length(trim(p.full_name)) > 0 then score := score + 15; end if;
  if p.academic_level is not null then score := score + 20; end if;
  if p.discipline is not null and length(trim(p.discipline)) > 0 then score := score + 20; end if;
  if p.gpa is not null then score := score + 15; end if;
  if p.nationality is not null and length(trim(p.nationality)) > 0 then score := score + 15; end if;
  if p.career_goals is not null and length(trim(p.career_goals)) > 0 then score := score + 15; end if;
  return score;
end;
$$;

create or replace function set_profile_completeness()
returns trigger
language plpgsql
as $$
begin
  new.profile_completeness := compute_profile_completeness(new);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_profile_completeness on profiles;
create trigger trg_set_profile_completeness
  before insert or update on profiles
  for each row execute function set_profile_completeness();

-- ── auth.users -> profiles bootstrap ───────────────────────
-- Creates a bare profile row the moment someone signs up, so the
-- onboarding wizard only ever needs to UPDATE, never INSERT.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row Level Security ──────────────────────────────────────
alter table profiles enable row level security;
alter table scholarships enable row level security;
alter table scholarship_rules enable row level security;
alter table saved_scholarships enable row level security;
alter table notifications enable row level security;

-- profiles: owner-only
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- scholarships: readable by any authenticated user, writes via service role only (admin API routes)
drop policy if exists "scholarships_select_authenticated" on scholarships;
create policy "scholarships_select_authenticated" on scholarships for select
  using (auth.role() = 'authenticated');

-- scholarship_rules: readable by any authenticated user (needed client-side for the "Your Eligibility" checklist)
drop policy if exists "scholarship_rules_select_authenticated" on scholarship_rules;
create policy "scholarship_rules_select_authenticated" on scholarship_rules for select
  using (auth.role() = 'authenticated');

-- saved_scholarships: owner-only, full CRUD
drop policy if exists "saved_select_own" on saved_scholarships;
create policy "saved_select_own" on saved_scholarships for select using (auth.uid() = profile_id);
drop policy if exists "saved_insert_own" on saved_scholarships;
create policy "saved_insert_own" on saved_scholarships for insert with check (auth.uid() = profile_id);
drop policy if exists "saved_delete_own" on saved_scholarships;
create policy "saved_delete_own" on saved_scholarships for delete using (auth.uid() = profile_id);

-- notifications: owner-only read
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select using (auth.uid() = profile_id);

-- Note: admin write access to scholarships/scholarship_rules is handled via
-- API routes using the service-role key (see lib/supabase/server.ts ->
-- createAdminClient), not via RLS policies, per 03_DATABASE_SCHEMA.md.
