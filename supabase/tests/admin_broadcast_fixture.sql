-- Minimal local Supabase schema for the production objects this migration uses.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table auth.users (id uuid primary key, email varchar(255) unique, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, is_admin boolean not null default false, full_name text);
create type public.opportunity_type as enum ('fellowship','internship','competition','mentorship');
create table public.scholarships (
  id uuid primary key, slug text not null, title text not null, provider_name text not null, amount text, deadline date, verified boolean not null,
  opens_at date, last_cycle_closed_at date
);
create table public.opportunities (
  id uuid primary key, slug text not null, title text not null, provider_name text not null, compensation text,
  deadline date, verified boolean not null, type public.opportunity_type not null, opens_at date
);
-- Expo tokens are already provisioned in production before migration 0078.
create table public.push_tokens (
  id uuid primary key, profile_id uuid not null references public.profiles(id),
  expo_push_token text not null, enabled boolean not null default true,
  unique (profile_id, expo_push_token)
);
create table public.saved_scholarships (profile_id uuid references public.profiles, scholarship_id uuid references public.scholarships);
create table public.saved_opportunities (profile_id uuid references public.profiles, opportunity_id uuid references public.opportunities);
create type public.application_status as enum ('in_progress', 'submitted', 'accepted', 'rejected');
create table public.applications (
  profile_id uuid references public.profiles, scholarship_id uuid not null references public.scholarships,
  opportunity_id uuid references public.opportunities, status public.application_status not null
);
create type public.notification_type as enum ('deadline_reminder', 'new_match', 'opportunity_deadline_passed');
create table public.notifications (
  profile_id uuid not null references public.profiles, scholarship_id uuid references public.scholarships,
  opportunity_id uuid references public.opportunities, type public.notification_type not null, metadata jsonb not null
);
alter default privileges in schema public grant all on tables to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid, 'student' || n || '@example.invalid',
  '{"full_name":"Synthetic Student"}'
from generate_series(1, 305) n;
insert into public.profiles (id) select id from auth.users
where email <> 'student300@example.invalid'; -- Auth users without profiles are still eligible for email.
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-000000000001'), ('a0000000-0000-4000-8000-000000000002');
insert into public.profiles (id, is_admin) values
  ('a0000000-0000-4000-8000-000000000001', true), ('a0000000-0000-4000-8000-000000000002', true);
insert into public.scholarships (id, slug, title, provider_name, amount, deadline, verified) values
  ('b0000000-0000-4000-8000-000000000001','one','One','Synthetic','1',null,true),
  ('b0000000-0000-4000-8000-000000000002','two','Two','Synthetic','2',null,true),
  ('b0000000-0000-4000-8000-000000000003','three','Three','Synthetic','3',null,true);
insert into public.opportunities (id, slug, title, provider_name, compensation, deadline, verified, type) values
  ('b0000000-0000-4000-8000-000000000004','four','Four','Synthetic','4',null,true,'fellowship');
insert into public.push_tokens (id, profile_id, expo_push_token)
select ('c0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid, 'ExpoPushToken[test' || n || ']'
from generate_series(1, 78) n;
