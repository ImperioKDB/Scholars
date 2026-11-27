-- Minimal local Supabase schema for the production objects this migration uses.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table auth.users (id uuid primary key, email text unique, raw_user_meta_data jsonb);
create table public.profiles (id uuid primary key, is_admin boolean not null default false);
create table public.scholarships (
  id uuid primary key, slug text, title text not null, provider_name text not null, amount text, deadline date, verified boolean
);
create table public.opportunities (
  id uuid primary key, slug text, title text not null, provider_name text not null, compensation text,
  deadline date, verified boolean, type text
);
-- Expo tokens are already provisioned in production before migration 0078.
create table public.push_tokens (
  id uuid primary key, profile_id uuid not null references public.profiles(id),
  expo_push_token text not null, enabled boolean not null default true
);
alter default privileges in schema public grant all on tables to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid, 'student' || n || '@example.invalid',
  '{"full_name":"Synthetic Student"}'
from generate_series(1, 305) n;
insert into public.profiles (id) select id from auth.users
where email <> 'student300@example.invalid'; -- Auth users without profiles are still eligible for email.
insert into public.profiles (id, is_admin) values
  ('a0000000-0000-4000-8000-000000000001', true), ('a0000000-0000-4000-8000-000000000002', true);
insert into public.scholarships values
  ('b0000000-0000-4000-8000-000000000001','one','One','Synthetic','1',null,true),
  ('b0000000-0000-4000-8000-000000000002','two','Two','Synthetic','2',null,true),
  ('b0000000-0000-4000-8000-000000000003','three','Three','Synthetic','3',null,true);
insert into public.opportunities values
  ('b0000000-0000-4000-8000-000000000004','four','Four','Synthetic','4',null,true,'fellowship');
insert into public.push_tokens (id, profile_id, expo_push_token)
select ('c0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid, 'ExpoPushToken[test' || n || ']'
from generate_series(1, 78) n;
