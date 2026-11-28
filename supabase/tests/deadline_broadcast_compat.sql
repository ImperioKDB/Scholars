-- Run after the pinned PR #51 broadcast database scenarios, on disposable PostgreSQL only.
begin;

create function pg_temp.broadcast_snapshot() returns jsonb language sql as $$
  select jsonb_agg(to_jsonb(snapshot) order by source, record)
  from (
    select 'historical email log' as source, to_jsonb(l) as record from public.broadcast_delivery_log l
    union all
    select 'broadcast outbox', to_jsonb(d) from public.notification_deliveries d
      where d.campaign_key in ('admin_broadcast', 'admin_broadcast_v2')
    union all select 'campaigns', to_jsonb(c) from public.broadcast_campaigns c
    union all select 'submissions', to_jsonb(s) from public.broadcast_submissions s
    union all select 'targets', to_jsonb(t) from public.broadcast_targets t
    union all select 'provider windows', to_jsonb(w) from public.broadcast_provider_windows w
    union all select 'provider state', to_jsonb(s) from public.broadcast_provider_state s
    union all
    select 'broadcast jobs', to_jsonb(j) from public.workflow_jobs j
      where j.kind in ('broadcast_email', 'broadcast_push')
  ) snapshot;
$$;

create temporary table deadline_before_broadcast as select pg_temp.broadcast_snapshot() as contents;

insert into auth.users (id, email, email_confirmed_at)
values ('fa000000-0000-4000-8000-000000000001', 'deadline-compat@example.invalid', now());
insert into public.profiles (id, deadline_email_enabled)
values ('fa000000-0000-4000-8000-000000000001', true);
insert into public.push_tokens (id, profile_id, expo_push_token)
values ('fa000000-0000-4000-8000-000000000002', 'fa000000-0000-4000-8000-000000000001', 'ExpoPushToken[deadline-compat]');
insert into public.scholarships (id, slug, title, provider_name, deadline, verified) values
  ('fa000000-0000-4000-8000-000000000003', 'deadline-email-compat', 'Email compatibility', 'Synthetic',
    (now() at time zone 'Africa/Lagos')::date + 7, true),
  ('fa000000-0000-4000-8000-000000000004', 'deadline-push-compat', 'Push compatibility', 'Synthetic',
    (now() at time zone 'Africa/Lagos')::date + 3, true);
insert into public.saved_scholarships (profile_id, scholarship_id) values
  ('fa000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000003'),
  ('fa000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000004');

set local role service_role;
do $$
declare
  mail record;
  push record;
begin
  perform public.prepare_deadline_reminders(7, 3, true, false);
  select * into strict mail from public.claim_deadline_reminders('email', 7, 3, false, 10, 10);
  select * into strict push from public.claim_deadline_reminders('push', 7, 3, false, 0, 0);
  if mail.email is distinct from 'deadline-compat@example.invalid' or mail.deadline_stage <> 'seven_days'
    or push.email is not null or push.deadline_stage <> 'three_days' then
    raise exception 'Both deadline channels must claim the expected synthetic intents';
  end if;
end;
$$;

reset role;
do $$
begin
  if pg_temp.broadcast_snapshot() is distinct from (select contents from deadline_before_broadcast) then
    raise exception 'Deadline prepare or claim changed historical or new broadcast records';
  end if;
end;
$$;

select 'Both deadline channels claimed due work without changing any broadcast records' as result;
rollback;
