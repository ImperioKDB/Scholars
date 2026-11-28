-- Isolated staging only. IDs are reserved for these fixtures and all
-- identities are synthetic. Direct auth inserts do not send auth email.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (
    select 1 from auth.users
    where email is null or email !~ '^deadline-staging-[0-9]{1,3}@example[.]invalid$'
      or id::text !~ '^dead1a6e-0000-4000-8000-000000000[0-9]{3}$'
  ) or exists (
    select 1 from public.profiles
    where id::text !~ '^dead1a6e-0000-4000-8000-000000000[0-9]{3}$'
  ) or exists (select 1 from public.push_tokens)
    or exists (select 1 from public.web_push_subscriptions) then
    raise exception 'Staging fixture operation requires only deadline test identities and no devices';
  end if;
end;
$$;

\if :cleanup
delete from auth.users
where email ~ '^deadline-staging-[0-9]{1,3}@example[.]invalid$'
  and id::text ~ '^dead1a6e-0000-4000-8000-000000000[0-9]{3}$';
delete from public.scholarships
where id = 'dead1a6e-0000-4000-8000-000000009999'
  and title = 'Deadline staging fixture';
\else
do $$
begin
  if exists (select 1 from auth.users) or exists (select 1 from public.profiles)
    or exists (select 1 from public.scholarships where id = 'dead1a6e-0000-4000-8000-000000009999') then
    raise exception 'Clean up previous deadline fixtures before reseeding';
  end if;
end;
$$;

insert into public.scholarships (id, title, provider_name, slug, deadline, level, verified)
values ('dead1a6e-0000-4000-8000-000000009999', 'Deadline staging fixture', 'Synthetic provider',
  'deadline-staging-fixture', (now() at time zone 'Africa/Lagos')::date, 'both', true);

create temporary table deadline_stage_people on commit drop as
select n, ('dead1a6e-0000-4000-8000-000000000' || lpad(n::text, 3, '0'))::uuid as id
from generate_series(1, :fixture_count) numbers(n);

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data)
select id, 'authenticated', 'authenticated', 'deadline-staging-' || n || '@example.invalid',
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}' from deadline_stage_people;

-- A deployment may populate profiles through an auth trigger.
insert into public.profiles (id, full_name, deadline_in_app_enabled, deadline_push_enabled, deadline_email_enabled)
select id, 'Deadline staging user ' || n, true, false, false from deadline_stage_people
on conflict (id) do update set deadline_in_app_enabled = true,
  deadline_push_enabled = false, deadline_email_enabled = false;

insert into public.saved_scholarships (profile_id, scholarship_id)
select id, 'dead1a6e-0000-4000-8000-000000009999' from deadline_stage_people
where :fixture_count > 3 or n <> 2;

insert into public.applications (profile_id, scholarship_id, status)
select id, 'dead1a6e-0000-4000-8000-000000009999',
  case n when 2 then 'in_progress'::public.application_status else 'not_applied'::public.application_status end
from deadline_stage_people where :fixture_count = 3 and n in (2, 3);
\endif

commit;
