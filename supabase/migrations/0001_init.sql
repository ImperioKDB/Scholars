-- Migration: 0001_init.sql
-- Scholarship Platform — initial schema (MVP)
-- Source of truth: 03_DATABASE_SCHEMA.md
-- SCHEMA DEVIATION FLAGGED: added profiles.is_admin (boolean) — the schema doc
-- references an "admin role" for write access to scholarships/scholarship_rules
-- but never defines how admin is determined. This is the smallest addition that
-- satisfies that requirement. Revisit if you want claims-based admin instead.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
create type academic_level as enum ('undergrad', 'postgrad');
create type scholarship_level as enum ('undergrad', 'postgrad', 'both');
create type rule_operator as enum ('eq', 'gte', 'lte', 'in', 'exists');
create type notification_type as enum ('deadline_reminder', 'new_match');

-- ============================================================
-- profiles
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  academic_level academic_level,
  discipline text,
  gpa numeric,
  nationality text,
  gender text,
  financial_need boolean not null default false,
  career_goals text,
  is_admin boolean not null default false, -- SCHEMA ADDITION, see note above
  profile_completeness int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- scholarships
-- ============================================================
create table scholarships (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider_name text not null,
  description text,
  amount text,
  deadline date not null,
  application_url text,
  level scholarship_level not null default 'both',
  discipline text,
  verified boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_scholarships_deadline on scholarships(deadline);
create index idx_scholarships_verified on scholarships(verified);

-- ============================================================
-- scholarship_rules
-- ============================================================
create table scholarship_rules (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  field text not null,
  operator rule_operator not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_scholarship_rules_scholarship_id on scholarship_rules(scholarship_id);

-- ============================================================
-- saved_scholarships
-- ============================================================
create table saved_scholarships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (profile_id, scholarship_id)
);

create index idx_saved_scholarships_profile_id on saved_scholarships(profile_id);

-- ============================================================
-- notifications
-- ============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  scholarship_id uuid references scholarships(id) on delete set null,
  type notification_type not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_profile_id on notifications(profile_id);

-- ============================================================
-- updated_at trigger helper
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_scholarships_updated_at
  before update on scholarships
  for each row execute function set_updated_at();

-- ============================================================
-- profile_completeness trigger
-- Computed from 7 core fields. Each filled field = ~14.3%, rounded.
-- ============================================================
create or replace function calculate_profile_completeness(p profiles)
returns int
language plpgsql
immutable
as $$
declare
  filled int := 0;
  total int := 7;
begin
  if p.full_name is not null and p.full_name <> '' then filled := filled + 1; end if;
  if p.academic_level is not null then filled := filled + 1; end if;
  if p.discipline is not null and p.discipline <> '' then filled := filled + 1; end if;
  if p.gpa is not null then filled := filled + 1; end if;
  if p.nationality is not null and p.nationality <> '' then filled := filled + 1; end if;
  if p.financial_need is not null then filled := filled + 1; end if;
  if p.career_goals is not null and p.career_goals <> '' then filled := filled + 1; end if;

  return round((filled::numeric / total::numeric) * 100)::int;
end;
$$;

create or replace function set_profile_completeness()
returns trigger
language plpgsql
as $$
begin
  new.profile_completeness := calculate_profile_completeness(new);
  return new;
end;
$$;

create trigger trg_profiles_completeness
  before insert or update on profiles
  for each row execute function set_profile_completeness();

-- ============================================================
-- is_admin() helper — SECURITY DEFINER to avoid RLS recursion
-- when scholarship/rule policies need to check admin status.
-- ============================================================
create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select p.is_admin from profiles p where p.id = uid),
    false
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table scholarships enable row level security;
alter table scholarship_rules enable row level security;
alter table saved_scholarships enable row level security;
alter table notifications enable row level security;

-- profiles: owner-only read/write
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- scholarships: any authenticated user reads verified listings; admins read all + write
create policy "scholarships_select_verified" on scholarships
  for select using (
    verified = true or is_admin(auth.uid())
  );

create policy "scholarships_insert_admin" on scholarships
  for insert with check (is_admin(auth.uid()));

create policy "scholarships_update_admin" on scholarships
  for update using (is_admin(auth.uid()));

create policy "scholarships_delete_admin" on scholarships
  for delete using (is_admin(auth.uid()));

-- scholarship_rules: readable if parent scholarship is readable; admin write
create policy "scholarship_rules_select" on scholarship_rules
  for select using (
    exists (
      select 1 from scholarships s
      where s.id = scholarship_rules.scholarship_id
      and (s.verified = true or is_admin(auth.uid()))
    )
  );

create policy "scholarship_rules_insert_admin" on scholarship_rules
  for insert with check (is_admin(auth.uid()));

create policy "scholarship_rules_update_admin" on scholarship_rules
  for update using (is_admin(auth.uid()));

create policy "scholarship_rules_delete_admin" on scholarship_rules
  for delete using (is_admin(auth.uid()));

-- saved_scholarships: owner-only, matched via profile_id = auth.uid()
create policy "saved_select_own" on saved_scholarships
  for select using (auth.uid() = profile_id);

create policy "saved_insert_own" on saved_scholarships
  for insert with check (auth.uid() = profile_id);

create policy "saved_delete_own" on saved_scholarships
  for delete using (auth.uid() = profile_id);

-- notifications: owner-only read. No client-side insert/update policy —
-- these rows are written by the deadline-check cron job using the
-- service role key, which bypasses RLS by design.
create policy "notifications_select_own" on notifications
  for select using (auth.uid() = profile_id);
