-- Adapted copy of supabase/tests/admin_broadcast.test.sql
-- from ImperioKDB/Scholars commit bf27021d7a35f5fc032f78463e6bee6a22c2f37c
-- for hosted Supabase Session Pooler execution.
--
-- Preserves every substantive assertion from the original suite.
-- Wrapped in a rollback-only transaction so no fixture data persists.
-- No foundational DDL (roles, schemas, tables) is created or modified.
-- Adaptations are limited to synthetic data setup, hosted Auth handling,
-- role transitions, and transaction boundaries.

begin;

create function pg_temp.check_result(p_ok boolean, p_message text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'Assertion failed: %', p_message; end if;
end;
$$;

-- ======================================================================
-- Restored broadcast security assertions (from original suite)
-- ======================================================================

select pg_temp.check_result(not has_table_privilege('authenticated','public.broadcast_targets','select'), 'browser cannot read snapshots');
select pg_temp.check_result(not has_function_privilege('authenticated','public.broadcast_enqueue(uuid,uuid,uuid[],uuid[],text,text)','execute'), 'browser cannot enqueue directly');
select pg_temp.check_result(not has_function_privilege('anon','public.broadcast_begin(uuid,uuid,bigint,text,text)','execute'), 'anonymous cannot dispatch');
select pg_temp.check_result(not has_schema_privilege('authenticated','broadcast_private','usage'), 'private schema is restricted');

-- ======================================================================
-- Synthetic data setup for hosted staging (no foundational DDL)
-- Preserves original fixture semantics: recipient without an email profile,
-- original recipient ordering, and batch boundaries.
-- ======================================================================

-- 305 broadcast users with emails (300 for batch A, 5 for batch B offset 300)
-- This preserves the original batch boundaries: limit 300, offset 0 for batch A;
-- limit 300, offset 300 for batch B ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ exactly 5 quota_deferred recipients.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('10000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  'broadcast-user-' || lpad(n::text, 3, '0') || '@example.invalid',
  now(),
  jsonb_build_object('full_name', 'User ' || n)
from generate_series(1, 305) n
on conflict (id) do nothing;

-- Match the original fixture: the 300th email recipient has no profile.
insert into public.profiles (id, full_name, is_admin)
select id, 'User ' || substring(email from 'user-([0-9]+)'), false
from auth.users where email like 'broadcast-user-%@example.invalid' and email <> 'broadcast-user-300@example.invalid'
on conflict (id) do nothing;

delete from public.profiles where id = '10000000-0000-4000-8000-00000000012c';

-- Admin profiles (emails null to exclude from broadcast email audience)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', null, now(), jsonb_build_object('full_name', 'Admin One')),
  ('a0000000-0000-4000-8000-000000000002', null, now(), jsonb_build_object('full_name', 'Admin Two'))
on conflict (id) do nothing;
insert into public.profiles (id, full_name, is_admin) values
  ('a0000000-0000-4000-8000-000000000001', 'Admin One', true),
  ('a0000000-0000-4000-8000-000000000002', 'Admin Two', true)
on conflict (id) do update set is_admin = true;

-- The original fixture has one Expo token for each of 78 profiles.
insert into public.push_tokens (id, profile_id, expo_push_token, platform, enabled)
select ('40000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  ('10000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  'ExpoPushToken[BroadcastTest' || lpad(n::text, 3, '0') || ']', 'android', true
from generate_series(1, 78) n;

-- Additional web push subscriptions for profile 1 (51 more devices)
-- Original test: profile 1 has more Web Push devices than an invocation can send
insert into public.web_push_subscriptions (id, profile_id, endpoint, p256dh, auth)
select ('51000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001',
  'https://fcm.googleapis.com:443/send/synthetic-extra-' || n,
  'synthetic',
  'synthetic'
from generate_series(1, 51) n
on conflict (id) do nothing;

-- Historical broadcast delivery log entries (must remain untouched)
insert into public.broadcast_delivery_log (broadcast_id, recipient_email, status)
values ('f3b105fa-8ad2-4e1f-a752-d444ed98c11b', 'historical@example.invalid', 'sent');
insert into public.notification_deliveries (profile_id, campaign_key, channel, schedule_bucket, dedupe_key, template_version, status)
values ('10000000-0000-4000-8000-000000000001', 'admin_broadcast', 'push', '746a5c6e-fcdf-48b2-9f24-a044491ed74c',
  'admin-broadcast-push:746a5c6e-fcdf-48b2-9f24-a044491ed74c:historical', 'legacy', 'leased')
on conflict (dedupe_key) do nothing;

-- ======================================================================
-- Broadcast test body (service_role)
-- ======================================================================

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
  -- Create listings and opportunities for campaign content
  insert into public.scholarships (id, title, provider_name, slug, verified, deadline, level)
  values (listing, 'Test Scholarship', 'Synthetic', 'test-scholarship', true, current_date + 30, 'both');
  insert into public.opportunities (id, title, provider_name, slug, verified, deadline, type)
  values (opportunity, 'Test Opportunity', 'Synthetic', 'test-opportunity', true, current_date + 30, 'internship');
  insert into public.scholarships (id, title, provider_name, slug, verified, deadline, level)
  values (other_listing, 'Other Listing', 'Synthetic', 'other-listing', true, current_date + 30, 'both');

  -- Historical IDs must be rejected
  foreach v_id in array array['f3b105fa-8ad2-4e1f-a752-d444ed98c11b'::uuid, '746a5c6e-fcdf-48b2-9f24-a044491ed74c'::uuid] loop
    begin
      perform public.broadcast_enqueue(admin, v_id, array[listing], '{}', 'A', 'https://example.invalid');
      raise exception 'historical ID accepted';
    exception when sqlstate 'P0409' then null;
    end;
  end loop;

  -- Non-admin must be rejected
  begin
    perform public.broadcast_enqueue('10000000-0000-4000-8000-000000000001', campaign, array[listing], '{}', 'A', 'https://example.invalid');
    raise exception 'non-admin accepted';
  exception when insufficient_privilege then null;
  end;

  -- Enqueue campaign A
  v_status := public.broadcast_enqueue(admin, campaign, array[listing], array[opportunity], 'A', 'https://example.invalid');
  perform pg_temp.check_result((v_status #>> '{email,total}')::int = 300, '300 email recipients');
  perform pg_temp.check_result((v_status #>> '{push_profiles,total}')::int = 78, '78 push profiles');
  perform pg_temp.check_result((v_status #>> '{push_devices,total}')::int = 129, '129 snapshotted devices');

  perform pg_temp.check_result(exists (
    select 1 from public.broadcast_targets t
    where t.campaign_id = campaign and t.channel = 'email' and t.address = 'broadcast-user-300@example.invalid' and not exists (
      select 1 from public.profiles p where p.id = t.recipient_id
    )
  ), 'email audience includes the recipient without a profile');

  -- Equivalent active submission mapped to same campaign
  perform pg_temp.check_result((public.broadcast_enqueue(second_admin, alias_id, array[listing], array[opportunity], 'A',
    'https://example.invalid') ->> 'id')::uuid = campaign, 'equivalent active submission mapped');
  perform pg_temp.check_result((public.broadcast_status(admin, alias_id) ->> 'id')::uuid = campaign, 'alias survives reload');

  -- Submission ID changed meaning must be rejected
  begin
    perform public.broadcast_enqueue(admin, alias_id, array[other_listing], '{}', 'A', 'https://example.invalid');
    raise exception 'submission ID changed meaning';
  exception when sqlstate 'P0409' then null;
  end;

  -- Competing campaign B (batch B ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ offset 300 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ exactly 5 recipients)
  perform public.broadcast_enqueue(second_admin, competing, array[other_listing], '{}', 'B', 'https://example.invalid');
  select id into email_job from public.workflow_jobs where kind = 'broadcast_email' and correlation_id = campaign;
  select id into push_job from public.workflow_jobs where kind = 'broadcast_push' and correlation_id = campaign;
  select id into competing_job from public.workflow_jobs where kind = 'broadcast_email' and correlation_id = competing;

  -- Cross-channel claim blocked
  perform pg_temp.check_result(public.broadcast_claim(email_job,'push') is null, 'cross-channel claim blocked');

  -- Unrelated deadline work is outside broadcast leases
  insert into public.workflow_jobs (id, kind, idempotency_key, correlation_id)
    values ('e0000000-0000-4000-8000-000000000099','deadline_reminder','synthetic-deadline-job',campaign);
  perform pg_temp.check_result(public.broadcast_claim('e0000000-0000-4000-8000-000000000099','email') is null,
    'unrelated deadline work is outside broadcast leases');
  perform pg_temp.check_result(not (public.broadcast_due_jobs() @> '[{"id":"e0000000-0000-4000-8000-000000000099"}]'::jsonb),
    'unrelated deadline job is outside the scheduler');

  -- Provider quota: brevo daily allowance of 1
  insert into public.broadcast_provider_windows values ('brevo','daily',v_start,v_start + interval '1 day',1,0);
  v_claim := public.broadcast_claim(email_job, 'email');
  perform pg_temp.check_result(public.broadcast_claim(email_job,'email') is null, 'one lease per channel');
  v_target := (v_claim #>> '{target,id}')::bigint;
  v_intent := public.broadcast_begin(email_job,(v_claim ->> 'token')::uuid,v_target,'brevo',null);
  perform pg_temp.check_result(v_intent is not null, 'first durable intent owns quota');
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','synthetic-1',null,null);
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','synthetic-1',null,null);
  perform public.broadcast_release(email_job,(v_claim ->> 'token')::uuid);

  -- Competing campaign shares exhausted quota: exactly 5 quota_deferred
  update public.broadcast_provider_state set next_at = v_start where provider_key = 'brevo';
  v_claim := public.broadcast_claim(competing_job, 'email');
  perform pg_temp.check_result(public.broadcast_begin(competing_job,(v_claim ->> 'token')::uuid,
    (v_claim #>> '{target,id}')::bigint,'brevo',null) is null, 'second campaign shares exhausted quota');
  perform public.broadcast_release(competing_job,(v_claim ->> 'token')::uuid);
  v_status := public.broadcast_status(admin, competing);
  perform pg_temp.check_result((v_status #>> '{email,quota_deferred}')::int = 5
    and (v_status #>> '{email,failed}')::int = 0
    and v_status ->> 'completed_at' is null, 'quota deferrals stay open and visible');

  -- Push independent during email quota stop
  v_claim := public.broadcast_claim(push_job,'push');
  v_target := (v_claim #>> '{target,id}')::bigint;
  v_intent := public.broadcast_begin(push_job,(v_claim ->> 'token')::uuid,v_target,'expo',null);
  perform pg_temp.check_result(v_intent is not null, 'push independent during email quota stop');
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','synthetic-ticket',null,null);
  perform public.broadcast_release(push_job,(v_claim ->> 'token')::uuid);
  perform pg_temp.check_result((public.broadcast_status(admin,campaign) #>> '{push_profiles,accepted}')::int = 1, 'push profile rollup');

  -- Quota reset resumes existing intent
  update public.broadcast_provider_windows set ends_at = statement_timestamp() - interval '1 second' where provider = 'brevo';
  insert into public.broadcast_provider_windows values
    ('brevo','daily',statement_timestamp() - interval '1 second',statement_timestamp() + interval '23 hours',300,0);
  update public.broadcast_targets set available_at = v_start where campaign_id = competing;
  update public.workflow_jobs set available_at = v_start where id = competing_job;
  v_claim := public.broadcast_claim(competing_job,'email');
  v_target := (v_claim #>> '{target,id}')::bigint;
  v_intent := public.broadcast_begin(competing_job,(v_claim ->> 'token')::uuid,v_target,'brevo',null);
  perform pg_temp.check_result(v_intent is not null, 'quota reset resumes the existing intent');

  -- Expired dispatch is never reclaimed
  update public.workflow_jobs set lease_until = v_start where id = competing_job;
  v_claim := public.broadcast_claim(competing_job,'email');
  perform pg_temp.check_result((v_claim #>> '{target,id}')::bigint <> v_target, 'expired dispatch is never reclaimed');
  perform pg_temp.check_result((public.broadcast_status(admin,competing) #>> '{email,uncertain}')::int = 1, 'interrupted acceptance is uncertain');

  -- Late matching acceptance resolves without resend
  perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'accepted','late-synthetic-id',null,null);
  perform pg_temp.check_result((public.broadcast_status(admin,competing) #>> '{email,accepted}')::int = 1, 'late matching acceptance resolves without resend');

  -- Pre-dispatch reservation can resume
  v_target := (v_claim #>> '{target,id}')::bigint;
  update public.workflow_jobs set lease_until = v_start where id = competing_job;
  v_claim := public.broadcast_claim(competing_job,'email');
  perform pg_temp.check_result((v_claim #>> '{target,id}')::bigint = v_target, 'pre-dispatch reservation can resume');
  perform public.broadcast_release(competing_job,(v_claim ->> 'token')::uuid);

  -- A definitive provider rejection is terminal and never becomes an acceptance.
  begin
    update public.broadcast_provider_state set next_at = v_start where provider_key = 'brevo';
    v_claim := public.broadcast_claim(competing_job,'email');
    v_target := (v_claim #>> '{target,id}')::bigint;
    v_intent := public.broadcast_begin(competing_job,(v_claim ->> 'token')::uuid,v_target,'brevo',null);
    perform public.broadcast_finalize(v_target,(v_intent ->> 'attempt')::uuid,'failed',null,'synthetic_rejection',null);
    perform public.broadcast_release(competing_job,(v_claim ->> 'token')::uuid);
    perform pg_temp.check_result((public.broadcast_status(admin,competing) #>> '{email,failed}')::int = 1,
      'definitive provider rejection remains failed');
    raise sqlstate 'P0999' using message = 'restore quota after rejection scenario';
  exception when sqlstate 'P0999' then null;
  end;

  -- Complete all email targets (300 accepted)
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

  -- Complete all push targets (129 accepted across 78 profiles)
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

  -- Alternate submission ID remains sealed after completion
  perform pg_temp.check_result((public.broadcast_enqueue(second_admin, alias_id, array[listing], array[opportunity], 'A',
    'https://example.invalid') ->> 'id')::uuid = campaign, 'alternate submission ID remains sealed after completion');

  -- Historical email untouched
  perform pg_temp.check_result((select count(*) from public.broadcast_delivery_log where broadcast_id =
    'f3b105fa-8ad2-4e1f-a752-d444ed98c11b' and status = 'sent') = 1, 'historical email untouched');

  -- Historical push untouched
  perform pg_temp.check_result(exists (select 1 from public.notification_deliveries where campaign_key = 'admin_broadcast'
    and status = 'leased'), 'historical push untouched');
end;
$$;

reset role;

-- ======================================================================
-- Bookkeeping failure injection
-- ======================================================================

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
  insert into public.scholarships (id, title, provider_name, slug, verified, deadline, level)
  values ('b0000000-0000-4000-8000-000000000003', 'Bookkeeping Test', 'Synthetic', 'bookkeeping-test', true, current_date + 30, 'both');

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

\ir admin_broadcast_deadline_compat.sql

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
values ('fa000000-0000-4000-8000-000000000001', true)
on conflict (id) do update set deadline_email_enabled = excluded.deadline_email_enabled;
insert into public.push_tokens (id, profile_id, expo_push_token, platform)
values ('fa000000-0000-4000-8000-000000000002', 'fa000000-0000-4000-8000-000000000001', 'ExpoPushToken[deadline-compat]', 'android');
insert into public.scholarships (id, slug, title, provider_name, deadline, verified, level) values
  ('fa000000-0000-4000-8000-000000000003', 'deadline-email-compat', 'Email compatibility', 'Synthetic',
    (now() at time zone 'Africa/Lagos')::date + 7, true, 'both'),
  ('fa000000-0000-4000-8000-000000000004', 'deadline-push-compat', 'Push compatibility', 'Synthetic',
    (now() at time zone 'Africa/Lagos')::date + 3, true, 'both');
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

create function pg_temp.deadline_delivery_snapshot() returns jsonb language sql as $$
  select jsonb_agg(to_jsonb(d) order by id)
  from public.notification_deliveries d where campaign_key = 'deadline_reminder_v2';
$$;
create temporary table broadcast_before_deadline as
select pg_temp.deadline_delivery_snapshot() as contents;
grant select on broadcast_before_deadline to service_role;

set local role service_role;
do $$
declare
  job uuid;
  claim jsonb;
begin
  select j.id into strict job from public.workflow_jobs j
  where j.kind = 'broadcast_email' and j.correlation_id = 'e0000000-0000-4000-8000-000000000003';
  perform public.broadcast_due_jobs();
  claim := public.broadcast_claim(job, 'email');
  perform pg_temp.check_result(claim #>> '{target,id}' is not null, 'broadcast claims while deadline leases are active');
  perform public.broadcast_release(job, (claim ->> 'token')::uuid);
  perform pg_temp.check_result(
    (select contents from broadcast_before_deadline) is not null and
    pg_temp.deadline_delivery_snapshot() is not distinct from (select contents from broadcast_before_deadline),
    'broadcast scheduling, claim and release leave deadline deliveries unchanged');
end;
$$;
reset role;

select 'Broadcast scheduling, claim and release preserved active deadline deliveries' as result;

rollback;
