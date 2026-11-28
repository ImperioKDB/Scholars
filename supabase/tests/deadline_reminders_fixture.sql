-- Minimal contract fixture for disposable vanilla Postgres. Never run on Supabase.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email varchar(255), email_confirmed_at timestamptz);
create table public.profiles (id uuid primary key, full_name text);
create table public.scholarships (
  id uuid primary key, title text not null, deadline date, opens_at date,
  last_cycle_closed_at date, verified boolean not null
);
create table public.opportunities (
  id uuid primary key, title text not null, deadline date, opens_at date, verified boolean not null
);
create table public.saved_scholarships (
  profile_id uuid references public.profiles, scholarship_id uuid references public.scholarships on delete cascade,
  primary key (profile_id, scholarship_id)
);
create table public.saved_opportunities (
  profile_id uuid references public.profiles, opportunity_id uuid references public.opportunities on delete cascade,
  primary key (profile_id, opportunity_id)
);
create type public.application_status as enum ('in_progress', 'submitted', 'accepted', 'rejected');
create table public.applications (
  profile_id uuid references public.profiles, scholarship_id uuid not null references public.scholarships on delete cascade,
  opportunity_id uuid references public.opportunities on delete cascade, status public.application_status not null,
  unique (profile_id, scholarship_id), unique (profile_id, opportunity_id)
);
create type public.notification_type as enum ('deadline_reminder', 'new_match', 'opportunity_deadline_passed');
create table public.notifications (
  profile_id uuid not null references public.profiles,
  scholarship_id uuid references public.scholarships on delete set null,
  opportunity_id uuid references public.opportunities on delete set null,
  type public.notification_type not null, metadata jsonb not null
);
create table public.web_push_subscriptions (profile_id uuid references public.profiles, enabled boolean);
create table public.push_tokens (profile_id uuid references public.profiles, enabled boolean);
