create function pg_temp.check_result(p_ok boolean, p_message text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'Assertion failed: %', p_message; end if;
end;
$$;

select pg_temp.check_result(not has_table_privilege('authenticated','public.broadcast_targets','select'), 'browser cannot read snapshots');
select pg_temp.check_result(not has_function_privilege('authenticated','public.broadcast_enqueue(uuid,uuid,uuid[],uuid[],text,text)','execute'), 'browser cannot enqueue directly');
select pg_temp.check_result(not has_function_privilege('anon','public.broadcast_begin(uuid,uuid,bigint,text,text)','execute'), 'anonymous cannot dispatch');
select pg_temp.check_result(not has_schema_privilege('authenticated','broadcast_private','usage'), 'private schema is restricted');

-- Snapshotted push profile with more Web Push devices than an invocation can send.
insert into public.web_push_subscriptions (id, profile_id, endpoint, p256dh, auth)
select ('d0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001', 'https://fcm.googleapis.com/send/synthetic' || n, 'synthetic', 'synthetic'
from generate_series(1, 51) n;
insert into public.broadcast_delivery_log (broadcast_id,recipient_email,status)
values ('f3b105fa-8ad2-4e1f-a752-d444ed98c11b','historical@example.invalid','sent');
insert into public.notification_deliveries (profile_id,campaign_key,channel,schedule_bucket,dedupe_key,template_version,status)
values ('00000000-0000-4000-8000-000000000001','admin_broadcast','push','746a5c6e-fcdf-48b2-9f24-a044491ed74c',
  'admin-broadcast-push:746a5c6e-fcdf-48b2-9f24-a044491ed74c:historical','legacy','leased');

set role service_role;
do $$
declare
  admin constant uuid := 'a0000000-0000-4000-8000-000000000001';
  second_admin constant uuid := 'a0000000-0000-4000-8000-000000000002';
  campaign constant uuid := 'e0000000-0000-4000-8000-000000000001';
  alias_id constant uuid := 'e0000000-0000-4000-8000-000000000002';
  competing constant uuid := 'e0000000-0000-4000-8000-000000000003';
  listing constant uuid := 'b0000000-0000-4000-8000-000000000001';
  opportunity constant uuid := 'b0000000-0000-4000-8000-000000000004';
  other_listing constant uuid := 'b0000000-0000-4000-8000-000000000002';
  email_job uuid;
  push_job uuid;
  competing_job uuid;
  v_claim jsonb;
  v_intent jsonb;
  v_status jsonb;
  v_target bigint;
  v_id uuid;
  v_start timestamptz := statement_timestamp() - interval '1 hour';
begin
  foreach v_id in array array['f3b105fa-8ad2-4e1f-a752-d444ed98c11b'::uuid, '746a5c6e-fcdf-48b2-9f24-a044491ed74c'::uuid] loop
    begin
      perform public.broadcast_enqueue(admin, v_id, array[listing], '{}', 'A', 'https://example.invalid');
      raise exception 'historical ID accepted';
    exception when sqlstate 'P0409' then null;
    end;
  end loop;
  begin
    perform public.broadcast_enqueue('00000000-0000-4000-8000-000000000001', campaign, array[listing], '{}', 'A', 'https://example.invalid');
    raise exception 'non-admin accepted';
  exception when insufficient_privilege then null;
  end;
  v_status := public.broadcast_enqueue(admin, campaign, array[listing], array[opportunity], 'A', 'https://example.invalid');
  perform pg_temp.check_result((v_status #>> '{email,total}')::int = 300, '300 email recipients');
  perform pg_temp.check_result((v_status #>> '{push_profiles,total}')::int = 78, '78 push profiles');
  perform pg_temp.check_result((v_status #>> '{push_devices,total}')::int = 129, '129 snapshotted devices');
  perform pg_temp.check_result((public.broadcast_enqueue(second_admin, alias_id, array[listing], array[opportunity], 'A',
    'https://example.invalid') ->> 'id')::uuid = campaign, 'equivalent active submission mapped');
  perform pg_temp.check_result((public.broadcast_status(admin, alias_id) ->> 'id')::uuid = campaign, 'alias survives reload');
  begin
    perform public.broadcast_enqueue(admin, alias_id, array[other_listing], '{}', 'A', 'https://example.invalid');
    raise exception 'submission ID changed meaning';
  exception when sqlstate 'P0409' then null;
  end;

  perform public.broadcast_enqueue(second_admin, competing, array[other_listing], '{}', 'B', 'https://example.invalid');
  select id into email_job from public.workflow_jobs where kind = 'broadcast_email' and correlation_id = campaign;
  select id into push_job from public.workflow_jobs where kind = 'broadcast_push' and correlation_id = campaign;
  select id into competing_job from public.workflow_jobs where kind = 'broadcast_email' and correlation_id = competing;
  perform pg_temp.check_result(public.broadcast_claim(email_job,'push') is null, 'cross-channel claim blocked');
  insert into public.workflow_jobs (id, kind, idempotency_key, correlation_id)
    values ('e0000000-0000-4000-8000-000000000099','deadline_reminder','synthetic-deadline-job',campaign);
  perform pg_temp.check_result(public.broadcast_claim('e0000000-0000-4000-8000-000000000099','email') is null,
    'unrelated deadline work is outside broadcast leases');
  perform pg_temp.check_result(not (public.broadcast_due_jobs() @> '[{"id":"e0000000-0000-4000-8000-000000000099"}]'::jsonb),
    'unrelated deadline job is outside the scheduler');


  insert into public.broadcast_provider_windows values ('brevo','daily',v_start,v_start + interval '1 day',1,0);
  v_claim := public.broadcast_claim(email_job, 'email');
  perform pg_temp.check_result(public.broadcast_claim(email_job,'email') is null, 'one lease per channel');
  v_target := (v_claim #>> '{target,id}')::bigint;
  v_intent := public.broadcast_begin(email_job,(v_claim ->> 'token')::uuid,v_target,'brevo',null);
  perform pg_temp.check_result(v_intent is not null, 'first durable intent owns quota');
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','synthetic-1',null,null);
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','synthetic-1',null,null);
  perform public.broadcast_release(email_job,(v_claim ->> 'token')::uuid);

  update public.broadcast_provider_state set next_at = v_start where provider_key = 'brevo';
  v_claim := public.broadcast_claim(competing_job, 'email');
  perform pg_temp.check_result(public.broadcast_begin(competing_job,(v_claim ->> 'token')::uuid,
    (v_claim #>> '{target,id}')::bigint,'brevo',null) is null, 'second campaign shares exhausted quota');
  perform public.broadcast_release(competing_job,(v_claim ->> 'token')::uuid);
  v_status := public.broadcast_status(admin, competing);
  perform pg_temp.check_result((v_status #>> '{email,quota_deferred}')::int = 5
    and (v_status #>> '{email,failed}')::int = 0, 'quota deferrals are visible');

  v_claim := public.broadcast_claim(push_job,'push');
  v_target := (v_claim #>> '{target,id}')::bigint;
  v_intent := public.broadcast_begin(push_job,(v_claim ->> 'token')::uuid,v_target,'expo',null);
  perform pg_temp.check_result(v_intent is not null, 'push independent during email quota stop');
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','synthetic-ticket',null,null);
  perform public.broadcast_release(push_job,(v_claim ->> 'token')::uuid);
  perform pg_temp.check_result((public.broadcast_status(admin,campaign) #>> '{push_profiles,accepted}')::int = 1, 'push profile rollup');

  -- Advance the test clock by shifting the period and job due time in the isolated database.
  update public.broadcast_provider_windows set ends_at = statement_timestamp() - interval '1 second' where provider = 'brevo';
  insert into public.broadcast_provider_windows values
    ('brevo','daily',statement_timestamp() - interval '1 second',statement_timestamp() + interval '23 hours',300,0);
  update public.broadcast_targets set available_at = v_start where campaign_id = competing;
  update public.workflow_jobs set available_at = v_start where id = competing_job;
  v_claim := public.broadcast_claim(competing_job,'email');
  v_target := (v_claim #>> '{target,id}')::bigint;
  v_intent := public.broadcast_begin(competing_job,(v_claim ->> 'token')::uuid,v_target,'brevo',null);
  perform pg_temp.check_result(v_intent is not null, 'quota reset resumes the existing intent');
  -- Simulate the provider accepting immediately before a Worker vanished.
  update public.workflow_jobs set lease_until = v_start where id = competing_job;
  v_claim := public.broadcast_claim(competing_job,'email');
  perform pg_temp.check_result((v_claim #>> '{target,id}')::bigint <> v_target, 'expired dispatch is never reclaimed');
  perform pg_temp.check_result((public.broadcast_status(admin,competing) #>> '{email,uncertain}')::int = 1, 'interrupted acceptance is uncertain');
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','late-synthetic-id',null,null);
  perform pg_temp.check_result((public.broadcast_status(admin,competing) #>> '{email,accepted}')::int = 1, 'late matching acceptance resolves without resend');
  -- A reservation that never acquired a dispatch intent is safe to reclaim.
  v_target := (v_claim #>> '{target,id}')::bigint;
  update public.workflow_jobs set lease_until = v_start where id = competing_job;
  v_claim := public.broadcast_claim(competing_job,'email');
  perform pg_temp.check_result((v_claim #>> '{target,id}')::bigint = v_target, 'pre-dispatch reservation can resume');
  perform public.broadcast_release(competing_job,(v_claim ->> 'token')::uuid);

  for i in 1..299 loop
    update public.broadcast_provider_state set next_at = v_start where provider_key = 'brevo';
    v_claim := public.broadcast_claim(email_job,'email');
    perform pg_temp.check_result(v_claim is not null and v_claim #>> '{target,id}' is not null, 'claim pending email');
    v_target := (v_claim #>> '{target,id}')::bigint;
    v_intent := public.broadcast_begin(email_job,(v_claim ->> 'token')::uuid,v_target,'brevo',null);
    perform pg_temp.check_result(v_intent is not null, 'dispatch pending email');
    perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','synthetic-' || (i+1),null,null);
    perform public.broadcast_release(email_job,(v_claim ->> 'token')::uuid);
  end loop;
  perform pg_temp.check_result((select count(*) from public.broadcast_targets
    where campaign_id = campaign and channel = 'email' and status = 'accepted' and attempts = 1) = 300, 'completed once per email target');
  perform pg_temp.check_result((select count(*) from public.announcement_log) = 599, 'accepted listings recorded for existing profiles');
  perform pg_temp.check_result((public.broadcast_status(admin,campaign) ->> 'completed_at') is null, 'email completion does not finish push');

  for i in 1..128 loop
    update public.broadcast_provider_state set next_at = v_start where provider_key in ('expo','web:fcm.googleapis.com');
    v_claim := public.broadcast_claim(push_job,'push');
    v_target := (v_claim #>> '{target,id}')::bigint;
    v_intent := public.broadcast_begin(push_job,(v_claim ->> 'token')::uuid,v_target,
      case when v_claim #>> '{target,transport}' = 'expo' then 'expo' else 'web:fcm.googleapis.com' end,null);
    perform pg_temp.check_result(v_intent is not null, 'independent push target');
    perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted',null,null,null);
    perform public.broadcast_release(push_job,(v_claim ->> 'token')::uuid);
  end loop;
  v_status := public.broadcast_status(admin, campaign);
  perform pg_temp.check_result((v_status #>> '{push_devices,accepted}')::int = 129
    and (v_status #>> '{push_profiles,accepted}')::int = 78 and (v_status ->> 'completed_at') is not null, 'campaign completes after both lanes');
  perform pg_temp.check_result((public.broadcast_enqueue(second_admin, alias_id, array[listing], array[opportunity], 'A',
    'https://example.invalid') ->> 'id')::uuid = campaign, 'alternate submission ID remains sealed after completion');
  perform pg_temp.check_result((select count(*) from public.broadcast_delivery_log where broadcast_id =
    'f3b105fa-8ad2-4e1f-a752-d444ed98c11b' and status = 'sent') = 1, 'historical email untouched');
  perform pg_temp.check_result(exists (select 1 from public.notification_deliveries where campaign_key = 'admin_broadcast'
    and status = 'leased'), 'historical push untouched');
end;
$$;
reset role;

create function pg_temp.inject_bookkeeping_failure() returns trigger language plpgsql as $$
begin
  raise exception 'synthetic announcement write failure';
end;
$$;
create trigger inject_bookkeeping_failure before insert on public.announcement_log
  for each row execute function pg_temp.inject_bookkeeping_failure();

set role service_role;
do $$
declare
  admin constant uuid := 'a0000000-0000-4000-8000-000000000001';
  campaign constant uuid := 'e0000000-0000-4000-8000-000000000004';
  job uuid;
  claim jsonb;
  intent jsonb;
  target bigint;
begin
  perform public.broadcast_enqueue(admin,campaign,array['b0000000-0000-4000-8000-000000000003'::uuid],'{}','B','https://example.invalid');
  select id into job from public.workflow_jobs where correlation_id = campaign and kind = 'broadcast_email';
  insert into public.broadcast_provider_windows values
    ('resend','daily',statement_timestamp() - interval '1 hour',statement_timestamp() + interval '23 hours',10,0),
    ('resend','monthly',statement_timestamp() - interval '1 hour',statement_timestamp() + interval '30 days',10,0);
  claim := public.broadcast_claim(job,'email');
  target := (claim #>> '{target,id}')::bigint;
  intent := public.broadcast_begin(job,(claim ->> 'token')::uuid,target,'resend',null);
  perform public.broadcast_finalize(target,(intent ->> 'attempt')::uuid,'accepted','synthetic-bookkeeping',null,null);
  perform public.broadcast_finalize(target,(intent ->> 'attempt')::uuid,'accepted','synthetic-bookkeeping',null,null);
  perform pg_temp.check_result((select status = 'accepted' and bookkeeping_error and provider_message_id = 'synthetic-bookkeeping'
    from public.broadcast_targets where id = target), 'bookkeeping error preserves acceptance and provider receipt');
  perform public.broadcast_release(job,(claim ->> 'token')::uuid);
end;
$$;
reset role;
