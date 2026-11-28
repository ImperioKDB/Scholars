-- Run through the staging-only database wrapper. Preflight rolls back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (select 1 from auth.users) or exists (select 1 from public.profiles)
    or exists (select 1 from public.push_tokens) or exists (select 1 from public.web_push_subscriptions) then
    raise exception 'Staging preflight requires an empty user, profile and device baseline';
  end if;
  if to_regprocedure('public.prepare_deadline_reminders(integer,integer,boolean,boolean)') is not null then
    raise exception 'Deadline migration already present. Inspect the staging migration history';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists (select 1 from supabase_migrations.schema_migrations where version = '20261127000000') then
      raise exception 'Deadline migration version already recorded. Use a forward migration';
    end if;
  end if;
  if not has_table_privilege('service_role', 'public.notification_deliveries', 'SELECT')
    or not has_table_privilege('service_role', 'public.notification_deliveries', 'UPDATE') then
    raise exception 'Expected outbox privileges are missing';
  end if;
  if (select count(*) from pg_class where relrowsecurity and oid in (
    'public.profiles'::regclass, 'public.notifications'::regclass, 'public.notification_deliveries'::regclass
  )) <> 3 then
    raise exception 'Expected profile, inbox or outbox RLS is missing';
  end if;
end;
$$;

select email, email_confirmed_at from auth.users limit 0;
\ir ../migrations/20261127000000_complete_deadline_reminders.sql

do $$
begin
  if exists (
    select 1 from (values ('anon'), ('authenticated')) roles(role_name)
    cross join (values
      ('public.prepare_deadline_reminders(integer,integer,boolean,boolean)'),
      ('public.claim_deadline_reminders(text,integer,integer,boolean,integer,integer)'),
      ('public.deadline_reminder_backlog(integer,integer,boolean)')
    ) rpcs(signature)
    where has_function_privilege(role_name, signature, 'EXECUTE')
  ) then
    raise exception 'A browser role can execute a deadline Worker RPC';
  end if;
end;
$$;

set local role service_role;
select public.prepare_deadline_reminders(7, 3, false, false);
select public.deadline_reminder_backlog(7, 3, false);

\if :apply
-- The probe has no students, but it writes one scheduler marker.
reset role;
delete from public.deadline_reminder_run;
commit;
\else
rollback;
\endif
