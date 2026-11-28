-- Window snapshots and a single expiring owner shared by both cron entry points.
create table public.new_match_windows (
  day date primary key,
  window_start timestamptz not null,
  window_end timestamptz not null,
  profile_ceiling uuid,
  last_profile_id uuid,
  phase text not null check (phase in ('discovery', 'delivery', 'complete')),
  scholarships jsonb not null,
  rules jsonb not null
);
create index new_match_windows_open_idx on public.new_match_windows (day) where phase <> 'complete';

create table public.new_match_worker (
  singleton boolean primary key default true check (singleton),
  owner uuid,
  lease_until timestamptz,
  phase text check (phase in ('discovery', 'delivery', 'sending')),
  window_day date references public.new_match_windows,
  page_ids uuid[] not null default '{}',
  page_end uuid,
  page_has_more boolean not null default false
);
insert into public.new_match_worker default values;

alter table public.new_match_windows enable row level security;
alter table public.new_match_worker enable row level security;
revoke all on public.new_match_windows, public.new_match_worker from public, anon, authenticated, service_role;

-- Disable the proposed legacy progress API. Existing delivery rows are retained.
revoke execute on function public.try_claim_push_campaign(text, timestamptz),
  public.release_push_campaign(text), public.reclaim_stale_push_campaign(text, integer)
  from public, anon, authenticated, service_role;
revoke all on public.push_campaign_progress from anon, authenticated, service_role;

alter table public.notification_deliveries add column new_match_send_owner uuid;
create index new_match_ready_idx on public.notification_deliveries (available_at, id)
  where campaign_key = 'new_match' and channel = 'push' and status in ('pending', 'retryable', 'leased');
create index new_match_profile_ready_idx on public.notification_deliveries (profile_id, available_at, id)
  where campaign_key = 'new_match' and channel = 'push' and status in ('pending', 'retryable', 'leased');
create index new_match_send_owner_idx on public.notification_deliveries (new_match_send_owner)
  where new_match_send_owner is not null;
create index new_match_inbox_idx on public.notifications (profile_id, scholarship_id)
  where type = 'new_match';

-- Keep the generic claim path out of the new-match push queue after cutover.
create or replace function public.claim_notification_delivery(p_delivery_id uuid, p_lease_until timestamptz)
returns table (id uuid, dedupe_key text)
language sql security definer set search_path = '' as $$
  update public.notification_deliveries d
  set status = 'leased', attempts = d.attempts + 1, available_at = now(), lease_until = p_lease_until
  where d.id = p_delivery_id and d.campaign_key <> 'deadline_reminder_v2'
    and not (d.campaign_key = 'new_match' and d.channel = 'push')
    and d.available_at <= now()
    and (d.status in ('pending', 'retryable') or (d.status = 'leased' and d.lease_until < now()))
  returning d.id, d.dedupe_key;
$$;

create function public.begin_new_match_step(p_owner uuid, p_start_window boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'UTC')::date;
  v_window public.new_match_windows%rowtype;
  v_page uuid[];
  v_eligible uuid[];
  v_profiles jsonb;
  v_has_more boolean;
  v_page_size integer;
begin
  if p_start_window and not exists (select 1 from public.new_match_windows where day = v_today) then
    -- Freeze the UTC date, 48-hour verification window, candidate set, and rules.
    -- Capture a new day's window even if an older window still has work.
    with listings as materialized (
      select s.id, s.title, s.provider_name, s.description, s.amount, s.deadline, s.opens_at,
        s.how_to_apply, s.level, s.discipline, s.verified, s.awards_available, s.estimated_applicant_pool,
        s.competitiveness_tier, s.historical_acceptance_rate, s.application_url, s.last_cycle_closed_at, s.last_verified_at
      from public.scholarships s
      where s.verified and s.level in ('undergrad', 'both')
        and s.last_verified_at between v_now - interval '48 hours' and v_now
        and (s.deadline is null or s.deadline >= v_today)
        and (s.opens_at is null or s.opens_at <= v_today)
        and (s.last_cycle_closed_at is null or s.last_cycle_closed_at > v_today)
      order by s.last_verified_at desc, s.id limit 250
    )
    insert into public.new_match_windows (day, window_start, window_end, profile_ceiling, phase, scholarships, rules)
    select v_today, v_now - interval '48 hours', v_now,
      (select id from public.profiles order by id desc limit 1),
      case when exists (select 1 from listings) then 'discovery' else 'delivery' end,
      coalesce((select jsonb_agg(to_jsonb(l) order by l.last_verified_at desc, l.id) from listings l), '[]'),
      coalesce((select jsonb_agg(to_jsonb(r) order by r.id)
                from public.scholarship_rules r join listings l on l.id = r.scholarship_id), '[]')
    on conflict (day) do nothing;
  end if;

  if p_owner is null then raise exception 'new_match owner required'; end if;
  perform 1 from public.new_match_worker
  where singleton and (lease_until is null or lease_until <= clock_timestamp())
  for update skip locked;
  if not found then return '{"phase":"busy"}'; end if;

  select * into v_window from public.new_match_windows where phase <> 'complete' order by day limit 1;
  update public.new_match_worker set owner = p_owner, lease_until = clock_timestamp() + interval '10 minutes',
    phase = coalesce(v_window.phase, 'delivery'), window_day = v_window.day,
    page_ids = '{}', page_end = null, page_has_more = false
  where singleton;
  if v_window.phase is distinct from 'discovery' then return '{"phase":"delivery"}'; end if;

  -- Bound the raw keyset page even for sparse opt-in populations. A profile
  -- without a device still advances the cursor, and can be considered tomorrow.
  v_page_size := greatest(1, least(100, 1000 / greatest(1,
    jsonb_array_length(v_window.scholarships) + jsonb_array_length(v_window.rules))));
  select array(select p.id from public.profiles p
    where p.id >= coalesce(v_window.last_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and p.id is distinct from v_window.last_profile_id and p.id <= v_window.profile_ceiling
    order by p.id limit (v_page_size + 1)) into v_page;
  v_has_more := cardinality(v_page) > v_page_size;
  v_page := v_page[1:v_page_size];

  select coalesce(array_agg(p.id), '{}'), coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]')
  into v_eligible, v_profiles
  from (
    select p.id, p.discipline, p.gpa, p.nationality, p.gender, p.financial_need, p.date_of_birth,
      p.state_of_origin, p.lga_of_origin, p.year_of_study, p.institution_type, p.jamb_score, p.waec_credit_count,
      p.has_english_maths_credit, p.disability_status, p.profile_completeness
    from public.profiles p where p.id = any(v_page)
      and (exists (select 1 from public.push_tokens t where t.profile_id = p.id and t.enabled)
        or exists (select 1 from public.web_push_subscriptions w where w.profile_id = p.id and w.enabled))
  ) p;

  update public.new_match_worker set page_ids = v_eligible,
    page_end = v_page[cardinality(v_page)], page_has_more = v_has_more where singleton;
  return jsonb_build_object('phase', 'discovery', 'day', v_window.day, 'profiles', v_profiles,
    'scholarships', v_window.scholarships, 'rules', v_window.rules);
end;
$$;

create function public.commit_new_match_page(p_owner uuid, p_day date, p_matches jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_worker public.new_match_worker%rowtype;
  v_queued integer;
begin
  select * into v_worker from public.new_match_worker
  where singleton and owner = p_owner and lease_until > clock_timestamp()
    and phase = 'discovery' and window_day = p_day for update;
  if not found then raise exception 'new_match discovery lease lost'; end if;
  if jsonb_array_length(p_matches) > cardinality(v_worker.page_ids) * 5 then
    raise exception 'new_match page exceeds match limit';
  end if;

  -- The enqueue, inbox insert, and cursor move share a transaction. Legacy
  -- inbox entries and all existing outbox statuses retain their dedupe keys.
  with matches as (
    select m.profile_id, m.scholarship_id, m.title, m.days_until, s.deadline,
      concat_ws(':', 'push:new_match', m.profile_id, m.scholarship_id) as dedupe_key
    from jsonb_to_recordset(p_matches) as m(profile_id uuid, scholarship_id uuid, title text, days_until integer)
    join public.profiles p on p.id = m.profile_id
    join public.new_match_windows w on w.day = p_day
    join jsonb_to_recordset(w.scholarships) as s(id uuid, deadline date) on s.id = m.scholarship_id
    join public.scholarships current_listing on current_listing.id = s.id
    where m.profile_id = any(v_worker.page_ids)
    for key share of p, current_listing
  ), queued as (
    insert into public.notification_deliveries
      (profile_id, scholarship_id, campaign_key, channel, schedule_bucket, dedupe_key, template_version)
    select profile_id, scholarship_id, 'new_match', 'push', 'newly-verified-scholarship-match',
      dedupe_key, 'push-new_match-v1'
    from matches
    on conflict (dedupe_key) do nothing
    returning dedupe_key
  ), inbox as (
    insert into public.notifications (profile_id, scholarship_id, type, metadata)
    select m.profile_id, m.scholarship_id, 'new_match',
      jsonb_build_object('title', m.title, 'deadline', m.deadline, 'days_until', m.days_until, 'dedupe_key', m.dedupe_key)
    from matches m join queued q using (dedupe_key)
    where not exists (select 1 from public.notifications n
      where n.profile_id = m.profile_id and n.scholarship_id = m.scholarship_id and n.type = 'new_match'
        and n.metadata->>'dedupe_key' = m.dedupe_key)
  )
  select count(*) into v_queued from queued;

  update public.new_match_windows set last_profile_id = coalesce(v_worker.page_end, last_profile_id),
    phase = case when v_worker.page_has_more then 'discovery' else 'delivery' end,
    scholarships = case when v_worker.page_has_more then scholarships else '[]'::jsonb end,
    rules = case when v_worker.page_has_more then rules else '[]'::jsonb end
  where day = p_day;
  update public.new_match_worker set owner = null, lease_until = null, phase = null,
    page_ids = '{}', page_end = null where singleton;
  return jsonb_build_object('more', true, 'queued', v_queued);
end;
$$;

create function public.claim_new_match_batch(p_owner uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lease timestamptz;
  v_result jsonb;
  v_today date := (statement_timestamp() at time zone 'Africa/Lagos')::date;
begin
  select lease_until into v_lease from public.new_match_worker
  where singleton and owner = p_owner and lease_until > clock_timestamp()
    and phase = 'delivery' for update;
  if not found then raise exception 'new_match delivery lease lost'; end if;
  update public.new_match_worker set phase = 'sending' where singleton;

  with heads as materialized (
    select d.profile_id, d.available_at, d.id from public.notification_deliveries d
    where d.campaign_key = 'new_match' and d.channel = 'push'
      and d.status in ('pending', 'retryable', 'leased') and d.available_at <= now()
      and (d.status <> 'leased' or coalesce(d.lease_until, '-infinity') <= now())
    order by d.available_at, d.id limit 20
  ), recipients as (
    select h.profile_id from heads h group by h.profile_id order by min(h.available_at), h.profile_id limit 4
  ), targets as materialized (
    select d.*, s.title, s.deadline,
      exists (select 1 from public.web_push_subscriptions w where w.profile_id = r.profile_id and w.enabled) as web_enabled,
      case
        when d.new_match_send_owner is not null then 'unknown'
        when s.verified is not true or s.last_verified_at is null or s.last_verified_at < now() - interval '7 days'
          or s.deadline < v_today or s.opens_at > v_today or s.last_cycle_closed_at <= v_today
          then 'suppressed'
        when not exists (select 1 from public.push_tokens t where t.profile_id = r.profile_id and t.enabled)
          and not exists (select 1 from public.web_push_subscriptions w where w.profile_id = r.profile_id and w.enabled)
          then 'suppressed'
        when d.attempts >= 3 then 'dead_letter'
        else 'leased'
      end as next_status
    from recipients r
    cross join lateral (
      select d.id, d.profile_id, d.scholarship_id, d.dedupe_key, d.attempts, d.new_match_send_owner
      from public.notification_deliveries d
      where d.profile_id = r.profile_id and d.campaign_key = 'new_match' and d.channel = 'push'
        and d.status in ('pending', 'retryable', 'leased') and d.available_at <= now()
        and (d.status <> 'leased' or coalesce(d.lease_until, '-infinity') <= now())
      order by d.available_at, d.id limit 5 for update skip locked
    ) d
    left join public.scholarships s on s.id = d.scholarship_id
  ), claimed as (
    update public.notification_deliveries d set status = t.next_status,
      attempts = d.attempts + case when t.next_status = 'leased' then 1 else 0 end,
      new_match_send_owner = case when t.next_status = 'leased' then p_owner end,
      lease_until = case when t.next_status = 'leased' then v_lease end,
      last_error = case t.next_status
        when 'unknown' then '{"code":"push_interrupted"}'::jsonb
        when 'suppressed' then '{"code":"push_no_longer_eligible"}'::jsonb
        when 'dead_letter' then '{"code":"push_attempt_limit"}'::jsonb
      end
    from targets t where d.id = t.id
    returning d.id, d.profile_id, d.scholarship_id, d.dedupe_key, d.status, d.attempts, t.title, t.deadline, t.web_enabled
  ), legacy_inbox as (
    insert into public.notifications (profile_id, scholarship_id, type, metadata)
    select c.profile_id, c.scholarship_id, 'new_match', jsonb_build_object(
      'title', coalesce(nullif(left(trim(regexp_replace(c.title, '[[:space:]]+', ' ', 'g')), 120), ''), 'this scholarship'),
      'deadline', c.deadline, 'days_until', c.deadline - (now() at time zone 'Africa/Lagos')::date,
      'dedupe_key', c.dedupe_key)
    from claimed c where c.status = 'leased' and not exists (
      select 1 from public.notifications n where n.profile_id = c.profile_id and n.scholarship_id = c.scholarship_id
        and n.type = 'new_match' and n.metadata->>'dedupe_key' = c.dedupe_key)
  ), bundles as (
    select profile_id, bool_or(web_enabled) as web_enabled,
      jsonb_agg(jsonb_build_object('id', id, 'title', title) order by attempts, id) as items
    from claimed where status = 'leased' group by profile_id
  )
  select jsonb_build_object(
    'bundles', coalesce((select jsonb_agg(to_jsonb(b)) from bundles b), '[]'),
    'suppressedDeliveries', (select count(*) from claimed where status = 'suppressed'),
    'unknownDeliveries', (select count(*) from claimed where status = 'unknown'),
    'deadLetterDeliveries', (select count(*) from claimed where status = 'dead_letter')
  ) into v_result;
  return v_result;
end;
$$;

create function public.finish_new_match_batch(p_owner uuid, p_outcomes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_worker public.new_match_worker%rowtype;
  v_ready boolean;
  v_suppressed integer;
  v_retryable integer;
  v_unknown integer;
  v_failed integer;
  v_dead_letter integer;
  v_accepted integer;
  v_retried integer;
begin
  select * into v_worker from public.new_match_worker
  where singleton and owner = p_owner and lease_until > clock_timestamp()
    and phase = 'sending' for update;
  if not found then raise exception 'new_match outcome lease lost'; end if;

  with outcomes as (
    select unnest(r.ids) as id, r.status
    from jsonb_to_recordset(p_outcomes) as r(ids uuid[], status text)
    where r.status in ('accepted', 'retryable', 'suppressed', 'unknown', 'failed')
  ), recorded as (
    update public.notification_deliveries d set
      status = case when o.status = 'retryable' and d.attempts >= 3 then 'dead_letter' else o.status end,
      lease_until = null, new_match_send_owner = null,
      available_at = case when o.status = 'retryable' and d.attempts < 3 then now() + interval '10 minutes' else d.available_at end,
      sent_at = case when o.status = 'accepted' then now() else d.sent_at end,
      last_error = case
        when o.status = 'retryable' and d.attempts >= 3 then '{"code":"push_attempt_limit"}'::jsonb
        when o.status = 'failed' then '{"code":"push_permanent_rejection"}'::jsonb
        when o.status <> 'accepted' then jsonb_build_object('code', 'push_' || o.status)
      end
    from outcomes o where d.id = o.id and d.status = 'leased' and d.new_match_send_owner = p_owner
      and d.lease_until = v_worker.lease_until
    returning d.status, d.profile_id, d.attempts
  ), accepted_profiles as (
    select profile_id, max(attempts) as attempts from recorded where status = 'accepted' group by profile_id
  )
  select count(*) filter (where status = 'suppressed'), count(*) filter (where status = 'retryable'),
    count(*) filter (where status = 'unknown'),
    count(*) filter (where status = 'failed'), count(*) filter (where status = 'dead_letter'),
    (select count(*) from accepted_profiles where attempts = 1),
    (select count(*) from accepted_profiles where attempts > 1)
  into v_suppressed, v_retryable, v_unknown, v_failed, v_dead_letter, v_accepted, v_retried from recorded;
  if exists (select 1 from public.notification_deliveries where new_match_send_owner = p_owner) then
    raise exception 'new_match batch outcome missing';
  end if;

  select exists (select 1 from public.notification_deliveries d
    where d.campaign_key = 'new_match' and d.channel = 'push'
      and d.status in ('pending', 'retryable', 'leased') and d.available_at <= now()
      and (d.status <> 'leased' or coalesce(d.lease_until, '-infinity') <= now())) into v_ready;

  -- Deferred retries remain in the outbox and are picked up by hourly drains.
  if not v_ready then
    update public.new_match_windows set phase = 'complete' where day = v_worker.window_day and phase = 'delivery';
  end if;
  update public.new_match_worker set owner = null, lease_until = null, phase = null where singleton;
  return jsonb_build_object('more', v_ready or exists (select 1 from public.new_match_windows where phase <> 'complete'),
    'suppressedDeliveries', v_suppressed, 'retryableDeliveries', v_retryable, 'unknownDeliveries', v_unknown,
    'failedDeliveries', v_failed, 'deadLetterDeliveries', v_dead_letter,
    'newMatchPushesAccepted', v_accepted, 'retryPushesAccepted', v_retried);
end;
$$;

revoke all on function public.begin_new_match_step(uuid, boolean), public.commit_new_match_page(uuid, date, jsonb),
  public.claim_new_match_batch(uuid), public.finish_new_match_batch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.begin_new_match_step(uuid, boolean), public.commit_new_match_page(uuid, date, jsonb),
  public.claim_new_match_batch(uuid), public.finish_new_match_batch(uuid, jsonb) to service_role;
