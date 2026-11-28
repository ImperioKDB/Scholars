-- Adapted copy of supabase/tests/deadline_reminders.sql
-- from ImperioKDB/Scholars commit bceeefb8517b99104a9ecb1d8930b2a12c4ea35b
-- for hosted Supabase Session Pooler execution.
--
-- Preserves every substantive assertion. Wrapped in a rollback-only
-- transaction so no fixture data persists. The original already contained
-- its own begin/rollback; this adaptation keeps that boundary and makes no
-- foundational DDL changes (no roles, schemas, or tables created).

begin;

create function pg_temp.check_that(pass boolean, reason text)
returns void language plpgsql as $$
begin
  if pass is distinct from true then raise exception '%', reason; end if;
end;
$$;

do $$
declare
  deadline date := '2026-11-30';
  cutoff timestamptz := '2026-11-30 23:00:00+00';
begin
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '8 days 1 second', 7, 3) is null, 'early starts at Lagos midnight 7 calendar days before');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '8 days', 7, 3) = 'seven_days', 'seven-day boundary');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '4 days', 7, 3) = 'three_days', 'three-day boundary');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '25 hours', 7, 3) = 'three_days', 'a missed older run uses the current stage');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '24 hours', 7, 3) = 'last_24h', 'start of deadline day in Lagos');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '12 hours', 7, 3) = 'day_of', 'day-of reminder starts at Lagos noon');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '1 second', 7, 3) = 'day_of', 'date-only deadline includes the whole day');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff, 7, 3) = 'passed', 'cutoff is Lagos midnight');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff + interval '24 hours', 7, 3) is null, 'stale missed deadline is never replayed');
  perform pg_temp.check_that(public.deadline_stage_at(deadline, cutoff - interval '8 days', 5, 2) is null, 'lead times are configurable');
  perform pg_temp.check_that(public.deadline_stage_at(null, cutoff, 7, 3) is null, 'unknown date is ignored');
  perform pg_temp.check_that(not exists (
    select 1 from (values ('anon'), ('authenticated')) roles(role_name)
    cross join (values
      ('public.claim_notification_delivery(uuid,timestamptz)'),
      ('public.prepare_deadline_reminders(integer,integer,boolean,boolean)'),
      ('public.claim_deadline_reminders(text,integer,integer,boolean,integer,integer)'),
      ('public.deadline_reminder_backlog(integer,integer,boolean)'),
      ('public.deadline_reminder_stats()')
    ) rpc(signature)
    where has_function_privilege(role_name, signature, 'EXECUTE')
  ), 'browser roles cannot use any deadline worker RPC');
  perform pg_temp.check_that(
    not has_table_privilege('authenticated', 'public.deadline_tracked_listings', 'SELECT')
      and not has_table_privilege('anon', 'public.deadline_email_attempts', 'SELECT')
      and not has_table_privilege('authenticated', 'public.deadline_reminder_run', 'SELECT'),
    'browser roles cannot read deadline worker objects');
end;
$$;

do $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  tracked uuid := gen_random_uuid();
  completed uuid := gen_random_uuid();
  declined uuid := gen_random_uuid();
  opted_out uuid := gen_random_uuid();
  saved_only uuid := gen_random_uuid();
  untouched uuid := gen_random_uuid();
  early uuid := gen_random_uuid();
  early_two uuid := gen_random_uuid();
  eligible_push uuid := gen_random_uuid();
  closed uuid := gen_random_uuid();
  future uuid := gen_random_uuid();
  unknown_deadline uuid := gen_random_uuid();
  passed uuid := gen_random_uuid();
  opp uuid := gen_random_uuid();
  removed uuid := gen_random_uuid();
  generated integer;
  picked integer;
  push_claim record;
  email_matches boolean;
  stats jsonb;
  expired_lease timestamptz := now() - interval '1 minute';
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    (tracked, 'tracked@example.test', now(), '{"full_name":"Tracked student"}'::jsonb),
    (completed, 'completed@example.test', now(), '{"full_name":"Completed student"}'::jsonb),
    (declined, 'declined@example.test', now(), '{"full_name":"Declined student"}'::jsonb),
    (opted_out, 'opted_out@example.test', now(), '{"full_name":"Opted out student"}'::jsonb),
    (saved_only, 'saved_only@example.test', now(), '{"full_name":"Saved only student"}'::jsonb),
    (untouched, 'untouched@example.test', now(), '{}'::jsonb);
  insert into public.profiles (id, full_name, deadline_in_app_enabled, deadline_push_enabled, deadline_email_enabled) values
    (tracked, 'Tracked student', true, true, true),
    (completed, 'Completed student', true, true, true),
    (opted_out, 'Opted out student', false, false, false),
    (saved_only, 'Saved only student', true, false, false),
    (untouched, 'Untouched student', true, true, true),
    (declined, 'Declined student', true, true, true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    deadline_in_app_enabled = excluded.deadline_in_app_enabled,
    deadline_push_enabled = excluded.deadline_push_enabled,
    deadline_email_enabled = excluded.deadline_email_enabled;
  insert into public.web_push_subscriptions (id, profile_id, endpoint, p256dh, auth) values
    (gen_random_uuid(), tracked, 'https://example.invalid/push-tracked', 'p256dh-tracked', 'auth-tracked'),
    (gen_random_uuid(), opted_out, 'https://example.invalid/push-optedout', 'p256dh-optedout', 'auth-optedout'),
    (gen_random_uuid(), completed, 'https://example.invalid/push-completed', 'p256dh-completed', 'auth-completed');

  insert into public.scholarships (id, title, provider_name, slug, verified, deadline, level, last_cycle_closed_at, opens_at) values
    (early, 'Early', 'Synthetic', 'early-scholarship', true, today + 7, 'both', null, null),
    (early_two, 'Another early', 'Synthetic', 'early-two-scholarship', true, today + 7, 'both', null, null),
    (eligible_push, 'Push', 'Synthetic', 'push-scholarship', true, today + 3, 'both', null, null),
    (closed, 'Closed', 'Synthetic', 'closed-scholarship', true, today + 3, 'both', today, null),
    (future, 'Not open', 'Synthetic', 'future-scholarship', true, today + 3, 'both', null, today + 1),
    (unknown_deadline, 'Unknown', 'Synthetic', 'unknown-scholarship', true, null, 'both', null, null),
    (passed, 'Passed', 'Synthetic', 'passed-scholarship', true, today - 1, 'both', null, null),
    (removed, 'Removed', 'Synthetic', 'removed-scholarship', true, today + 3, 'both', null, null);
  insert into public.opportunities (id, title, provider_name, slug, verified, deadline, type) values
    (opp, 'Tracked opportunity', 'Synthetic', 'tracked-opportunity', true, today + 3, 'internship');
  insert into public.saved_scholarships (profile_id, scholarship_id) values
    (tracked, early), (tracked, early_two), (tracked, closed), (tracked, future),
    (tracked, unknown_deadline), (tracked, passed), (tracked, removed),
    (completed, eligible_push), (declined, eligible_push), (opted_out, eligible_push), (saved_only, eligible_push);
  insert into public.applications (profile_id, scholarship_id, opportunity_id, status) values
    (tracked, eligible_push, null, 'in_progress'), (tracked, null, opp, 'in_progress'),
    (completed, eligible_push, null, 'submitted'), (declined, eligible_push, null, 'not_applied');

  generated := (public.prepare_deadline_reminders(7, 3, true, false)->>'generated')::int;
  perform pg_temp.check_that(generated = 12, 'expected channel intents for saved and tracked rows only');
  perform pg_temp.check_that((public.prepare_deadline_reminders(7, 3, true, false)->>'generated')::int = 0, 'repeat run is idempotent');
  perform pg_temp.check_that(
    (select count(*) = 7 from public.notifications), 'in-app does not depend on push or email');
  perform pg_temp.check_that(
    not exists (select 1 from public.notifications where profile_id in (completed, declined, opted_out, untouched)),
    'completed, opted-out and uninvolved students receive nothing');
  perform pg_temp.check_that(
    (select count(*) = 1 from public.notifications where scholarship_id = passed and metadata->>'deadline_stage' = 'passed'),
    'only the inbox gets a passed reminder by default');

  delete from public.scholarships where id = removed;
  update public.scholarships set deadline = today + 7 where id = eligible_push;
  perform public.prepare_deadline_reminders(7, 3, true, false);
  perform pg_temp.check_that(
    (select count(*) = 1 from public.notification_deliveries where scholarship_id = eligible_push and status = 'suppressed'),
    'stale push suppressed after a deadline extension');
  perform pg_temp.check_that(
    (select count(*) = 1 from public.notifications where scholarship_id = eligible_push
      and metadata->>'deadline_stage' = 'seven_days' and profile_id = tracked), 'the new deadline has its own stage');
  update public.profiles set deadline_push_enabled = false where id = tracked;
  select count(*) into picked from public.claim_deadline_reminders('push', 7, 3, false, 0, 0);
  perform pg_temp.check_that(picked = 0, 'preferences are rechecked after a row is queued');
  update public.profiles set deadline_push_enabled = true where id = tracked;
  select * into strict push_claim from public.claim_deadline_reminders('push', 7, 3, false, 0, 0);
  perform pg_temp.check_that(
    push_claim.profile_id = tracked and push_claim.scholarship_id is null and push_claim.opportunity_id = opp
      and push_claim.title = 'Tracked opportunity' and push_claim.deadline_date = today + 3
      and push_claim.deadline_stage = 'three_days' and push_claim.application_status = 'in_progress'
      and push_claim.full_name = 'Tracked student' and push_claim.email is null
      and push_claim.attempts = 1 and push_claim.lease_until > now(),
    'push claims return the tracked opportunity without exposing the auth email');
  select count(*) into picked from public.claim_deadline_reminders('push', 7, 3, false, 0, 0);
  perform pg_temp.check_that(picked = 0, 'active push lease cannot be reclaimed');
  update public.notification_deliveries set lease_until = expired_lease
    where channel = 'push' and opportunity_id = opp;
  select count(*) into picked from public.claim_deadline_reminders('push', 7, 3, false, 0, 0);
  perform pg_temp.check_that(picked = 1, 'an expired push lease is recoverable');
  update public.notification_deliveries set status = 'accepted', lease_until = null
    where opportunity_id = opp and channel = 'push' and status = 'leased' and lease_until = expired_lease;
  get diagnostics picked = row_count;
  perform pg_temp.check_that(picked = 0, 'the old push lease cannot record late acceptance');
  update public.notification_deliveries set status = 'retryable', lease_until = null
    where opportunity_id = opp and channel = 'push' and status = 'leased' and lease_until = expired_lease;
  get diagnostics picked = row_count;
  perform pg_temp.check_that(picked = 0, 'the old push lease cannot record late failure');

  select count(*), bool_and((c.profile_id = tracked and c.email = 'tracked@example.test'
    and c.full_name = 'Tracked student' and c.opportunity_id is null and c.scholarship_id in (early, early_two, eligible_push)
    and c.deadline_date = today + 7 and c.deadline_stage = 'seven_days'
    and c.attempts = 1 and c.lease_until > now()) is true) into picked, email_matches
  from public.claim_deadline_reminders('email', 7, 3, false, 1, 4000) c;
  perform pg_temp.check_that(picked = 3, 'same student and stage share a single Mailtrap request');
  perform pg_temp.check_that(email_matches, 'email claims return the confirmed auth email and expected listings');
  perform pg_temp.check_that((select count(*) = 1 from public.deadline_email_attempts), 'quota counts sends, not listings');

  perform public.prepare_deadline_reminders(7, 3, true, true);
  select count(*) into picked from public.claim_deadline_reminders('email', 7, 3, true, 1, 4000);
  perform pg_temp.check_that(picked = 0, 'daily quota exhaustion blocks another send');
  select count(*) into picked from public.claim_deadline_reminders('email', 7, 3, true, 150, 1);
  perform pg_temp.check_that(picked = 0, 'monthly quota exhaustion blocks another send');

  update public.notification_deliveries set lease_until = expired_lease
    where channel = 'email' and status = 'leased';
  select count(*) into picked from public.claim_notification_delivery(
    (select id from public.notification_deliveries where channel = 'email' and status = 'leased' limit 1),
    now() + interval '10 minutes');
  perform pg_temp.check_that(picked = 0, 'legacy claim cannot recover a v2 email lease');
  select count(*) into picked from public.claim_deadline_reminders('email', 7, 3, false, 150, 4000);
  perform pg_temp.check_that(picked = 0, 'expired email is ineligible even before recovery');
  perform public.prepare_deadline_reminders(7, 3, true, false);
  perform pg_temp.check_that(
    (select count(*) = 3 from public.notification_deliveries where channel = 'email' and status = 'unknown'),
    'expired email lease becomes unknown rather than sending again');
  select count(*) into picked from public.claim_deadline_reminders('email', 7, 3, false, 150, 4000);
  perform pg_temp.check_that(picked = 0, 'unknown emails and disabled passed emails are not sent');
  stats := public.deadline_reminder_stats();
  perform pg_temp.check_that(
    (stats->'last_run'->>'started_at') is not null
      and (stats->'deliveries'->'in_app'->>'delivered')::int > 0
      and (stats->'deliveries'->'email'->>'unknown')::int = 3
      and (stats->>'daily_email_attempts')::int = 1
      and (stats->>'monthly_email_attempts')::int = 1,
    'admin statistics distinguish local delivery, unknown email and quota consumed');
end;
$$;

do $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  listing uuid := gen_random_uuid();
  summary jsonb;
begin
  insert into public.scholarships (id, title, provider_name, slug, verified, deadline, level) values
    (listing, 'Urgent cap test', 'Synthetic', 'urgent-cap-test', true, today, 'both');
  -- Insert Auth users first; the Auth trigger auto-creates their profiles.
  -- Configure notification preferences explicitly on those profiles.
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  select gen_random_uuid(), 'student-' || n || '@example.test', now(), '{}'::jsonb
  from generate_series(1, 501) as t(n)
  on conflict (id) do nothing;
  insert into public.saved_scholarships (profile_id, scholarship_id)
  select id, listing from auth.users where email like 'student-%@example.test';
  update public.profiles set deadline_in_app_enabled = true
  where id in (select id from auth.users where email like 'student-%@example.test');
  insert into public.web_push_subscriptions (id, profile_id, endpoint, p256dh, auth)
    select gen_random_uuid(), profile_id, 'https://example.invalid/push-cap', 'p256dh', 'auth'
    from public.saved_scholarships where scholarship_id = listing;
  summary := public.prepare_deadline_reminders(7, 3, false, false);
  perform pg_temp.check_that((summary->>'capacityReached')::boolean
    and (summary->>'inboxDelivered')::int = 500, 'capped discovery and inbox must be visible');
  perform pg_temp.check_that((public.deadline_reminder_backlog(7, 3, false)->>'push')::int = 500,
    'queued urgent push must remain visible even before claims are made');
  summary := public.prepare_deadline_reminders(7, 3, false, false);
  perform pg_temp.check_that((summary->>'inboxDelivered')::int = 1
    and not (summary->>'capacityReached')::boolean, 'next run advances beyond the cap');
end;
$$;

rollback;
