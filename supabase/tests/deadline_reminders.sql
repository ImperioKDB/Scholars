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
  insert into public.profiles (id, deadline_in_app_enabled, deadline_push_enabled, deadline_email_enabled) values
    (tracked, true, true, true), (completed, true, true, true), (opted_out, false, false, false),
    (saved_only, true, false, false), (untouched, true, true, true), (declined, true, true, true);
  update public.profiles set full_name = 'Tracked student' where id = tracked;
  insert into auth.users values
    (tracked, 'tracked@example.test', now()), (untouched, 'untouched@example.test', now());
  insert into public.web_push_subscriptions values (tracked, true), (opted_out, true), (completed, true);

  insert into public.scholarships values
    (early, 'Early', today + 7, null, null, true),
    (early_two, 'Another early', today + 7, null, null, true),
    (eligible_push, 'Push', today + 3, null, null, true),
    (closed, 'Closed', today + 3, null, today, true),
    (future, 'Not open', today + 3, today + 1, null, true),
    (unknown_deadline, 'Unknown', null, null, null, true),
    (passed, 'Passed', today - 1, null, null, true),
    (removed, 'Removed', today + 3, null, null, true);
  insert into public.opportunities values (opp, 'Tracked opportunity', today + 3, null, true);
  insert into public.saved_scholarships values
    (tracked, early), (tracked, early_two), (tracked, closed), (tracked, future),
    (tracked, unknown_deadline), (tracked, passed), (tracked, removed),
    (completed, eligible_push), (declined, eligible_push), (opted_out, eligible_push), (saved_only, eligible_push);
  insert into public.applications values
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

  -- Deletion cascades, and an extension invalidates an already queued push.
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
  insert into public.scholarships values (listing, 'Urgent cap test', today, null, null, true);
  with students as (
    insert into public.profiles (id) select gen_random_uuid() from generate_series(1, 501) returning id
  )
  insert into public.saved_scholarships select id, listing from students;
  insert into public.web_push_subscriptions
    select profile_id, true from public.saved_scholarships where scholarship_id = listing;
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
