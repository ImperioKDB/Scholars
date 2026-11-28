alter table public.profiles
  add column deadline_in_app_enabled boolean not null default true,
  add column deadline_push_enabled boolean not null default true,
  add column deadline_email_enabled boolean not null default false;

-- Support deployments that use column-level profile grants. Own-row RLS still applies.
grant insert (deadline_in_app_enabled, deadline_push_enabled, deadline_email_enabled),
  update (deadline_in_app_enabled, deadline_push_enabled, deadline_email_enabled)
  on public.profiles to authenticated;

alter table public.notification_deliveries
  add column opportunity_id uuid references public.opportunities(id) on delete cascade,
  add column deadline_date date,
  add column deadline_stage text,
  drop constraint notification_deliveries_channel_check,
  drop constraint notification_deliveries_status_check,
  add constraint notification_deliveries_channel_check
    check (channel in ('email', 'whatsapp', 'push', 'in_app')),
  add constraint notification_deliveries_status_check
    check (status in ('pending', 'leased', 'accepted', 'delivered', 'bounced', 'suppressed',
                      'failed', 'retryable', 'dead_letter', 'unknown'));

create index deadline_delivery_ready_idx
  on public.notification_deliveries (channel, available_at, created_at)
  where campaign_key = 'deadline_reminder_v2' and status in ('pending', 'retryable', 'leased');
create index deadline_email_receipts_idx
  on public.notification_deliveries (available_at, id)
  where campaign_key = 'deadline_reminder_v2' and channel = 'email'
    and status = 'accepted' and provider_message_id is not null;
create index deadline_delivery_opportunity_idx on public.notification_deliveries (opportunity_id)
  where opportunity_id is not null;

-- Keep legacy records intact during rolling deployment. The id-only legacy
-- claim RPC must never lease a deadline v2 row, including an expired email.
create or replace function public.claim_notification_delivery(
  p_delivery_id uuid, p_lease_until timestamptz
)
returns table (id uuid, dedupe_key text)
language sql security definer set search_path = '' as $$
  update public.notification_deliveries d
  set status = 'leased', attempts = d.attempts + 1,
    available_at = now(), lease_until = p_lease_until
  where d.id = p_delivery_id and d.campaign_key <> 'deadline_reminder_v2'
    and d.available_at <= now()
    and (d.status in ('pending', 'retryable') or (d.status = 'leased' and d.lease_until < now()))
  returning d.id, d.dedupe_key;
$$;
revoke all on function public.claim_notification_delivery(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(uuid, timestamptz) to service_role;

-- One reservation per API request, including uncertain requests. It contains no student data.
create table public.deadline_email_attempts (id bigint generated always as identity primary key,
  reserved_at timestamptz not null default clock_timestamp());
create index deadline_email_attempts_time_idx on public.deadline_email_attempts (reserved_at);
alter table public.deadline_email_attempts enable row level security;

create table public.deadline_reminder_run (
  id boolean primary key default true check (id),
  started_at timestamptz not null,
  generated integer not null
);
alter table public.deadline_reminder_run enable row level security;

-- Date-only deadlines include the entire listed day in Nigeria. Split its first
-- and second halves so the 24-hour and deadline-day reminders are distinct.
create function public.deadline_stage_at(p_deadline date, p_now timestamptz, p_early integer, p_push integer)
returns text language sql stable set search_path = '' as $$
  select case
    when p_now >= boundary.closes + interval '24 hours' then null
    when p_now >= boundary.closes then 'passed'
    when p_now >= boundary.closes - interval '12 hours' then 'day_of'
    when p_now >= boundary.closes - interval '24 hours' then 'last_24h'
    when p_now >= boundary.closes - (p_push + 1) * interval '24 hours' then 'three_days'
    when p_now >= boundary.closes - (p_early + 1) * interval '24 hours' then 'seven_days'
  end
  from (select (p_deadline + 1)::timestamp at time zone 'Africa/Lagos' as closes) boundary;
$$;

-- Student intent comes from the existing saved lists and application tracker.
-- A completed application overrides a save. Student scope never comes from a catalog-wide match.
create view public.deadline_tracked_listings with (security_invoker = true) as
select s.id, 'scholarship'::text as kind, s.title, s.deadline, s.opens_at,
  s.last_cycle_closed_at, tracked.profile_id, a.status::text as application_status
from public.scholarships s
cross join lateral (
  select ss.profile_id from public.saved_scholarships ss where ss.scholarship_id = s.id
  union
  select app.profile_id from public.applications app where app.scholarship_id = s.id and app.status = 'in_progress'
) tracked
left join public.applications a on a.scholarship_id = s.id and a.profile_id = tracked.profile_id
where s.verified and s.deadline is not null and (a.status is null or a.status = 'in_progress')
union all
select o.id, 'opportunity', o.title, o.deadline, o.opens_at, null::date,
  tracked.profile_id, a.status::text
from public.opportunities o
cross join lateral (
  select so.profile_id from public.saved_opportunities so where so.opportunity_id = o.id
  union
  select app.profile_id from public.applications app where app.opportunity_id = o.id and app.status = 'in_progress'
) tracked
left join public.applications a on a.opportunity_id = o.id and a.profile_id = tracked.profile_id
where o.verified and o.deadline is not null and (a.status is null or a.status = 'in_progress');

revoke all on public.deadline_tracked_listings, public.deadline_email_attempts,
  public.deadline_reminder_run from public, anon, authenticated;

create function public.prepare_deadline_reminders(
  p_early integer, p_push integer, p_email boolean, p_passed_email boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_generated integer;
  v_discovery_cap boolean;
  v_inbox_count integer;
begin
  -- Only one discovery/inbox transaction per scheduler run at a time.
  perform pg_advisory_xact_lock(72418613, 1);

  -- A timed-out email claim may already have reached Mailtrap. Never resend it.
  update public.notification_deliveries
  set status = 'unknown', lease_until = null, last_error = '{"code":"email_interrupted"}'
  where id in (
    select id from public.notification_deliveries
    where campaign_key = 'deadline_reminder_v2' and channel = 'email'
      and status = 'leased' and lease_until <= now()
    order by lease_until limit 500 for update skip locked
  );

  update public.notification_deliveries
  set status = 'dead_letter', lease_until = null, last_error = '{"code":"push_attempts_exhausted"}'
  where id in (
    select id from public.notification_deliveries
    where campaign_key = 'deadline_reminder_v2' and channel = 'push'
      and status = 'leased' and attempts >= 3 and lease_until <= now()
    order by lease_until limit 500 for update skip locked
  );

  with expired as (
    select d.id from public.notification_deliveries d
    where d.campaign_key = 'deadline_reminder_v2'
      and (d.status in ('pending', 'retryable')
        or (d.status = 'leased' and d.channel <> 'email' and d.lease_until <= now()))
      and (d.deadline_stage is distinct from public.deadline_stage_at(d.deadline_date, now(), p_early, p_push)
        or not exists (
          select 1 from public.deadline_tracked_listings l
          where l.profile_id = d.profile_id and l.deadline = d.deadline_date
            and l.id = coalesce(d.scholarship_id, d.opportunity_id)
            and l.kind = case when d.scholarship_id is not null then 'scholarship' else 'opportunity' end
            and (l.opens_at is null or l.opens_at <= least(v_today, l.deadline))
            and (l.last_cycle_closed_at is null or l.last_cycle_closed_at > v_today)
        ))
    order by d.created_at, d.id limit 1000 for update of d skip locked
  )
  update public.notification_deliveries d
  set status = 'suppressed', lease_until = null, last_error = '{"code":"deadline_stale"}'
  from expired where d.id = expired.id;

  -- Bound discovery per channel. Existing intents never occupy a discovery slot.
  with candidates as materialized (
    select l.*, stage.name as stage, p.deadline_in_app_enabled, p.deadline_push_enabled,
      p.deadline_email_enabled, u.email_confirmed_at
    from public.deadline_tracked_listings l
    join public.profiles p on p.id = l.profile_id
    left join auth.users u on p_email and u.id = l.profile_id and nullif(u.email, '') is not null
    cross join lateral (select public.deadline_stage_at(l.deadline, now(), p_early, p_push) as name) stage
    where l.deadline between v_today - 1 and v_today + p_early
      and (l.opens_at is null or l.opens_at <= least(v_today, l.deadline))
      and (l.last_cycle_closed_at is null or l.last_cycle_closed_at > v_today)
      and stage.name is not null
  ), created as (
  insert into public.notification_deliveries
    (profile_id, scholarship_id, opportunity_id, deadline_date, deadline_stage,
      campaign_key, channel, schedule_bucket, dedupe_key, template_version)
  select c.profile_id, case when c.kind = 'scholarship' then c.id end,
    case when c.kind = 'opportunity' then c.id end, c.deadline, c.stage,
    'deadline_reminder_v2', channel.name, c.stage, c.key, 'deadline-v2'
  from (values ('in_app'), ('push'), ('email')) channel(name)
  cross join lateral (
    select l.*, concat_ws(':', 'deadline-v2', channel.name, l.profile_id, l.kind, l.id, to_char(l.deadline, 'YYYY-MM-DD'), l.stage) as key
    from candidates l
    where case channel.name
      when 'in_app' then l.deadline_in_app_enabled
      when 'push' then l.deadline_push_enabled and l.stage in ('three_days', 'last_24h', 'day_of')
        and (exists (select 1 from public.web_push_subscriptions w where w.profile_id = l.profile_id and w.enabled)
          or exists (select 1 from public.push_tokens t where t.profile_id = l.profile_id and t.enabled))
      when 'email' then p_email and l.deadline_email_enabled and l.email_confirmed_at is not null
        and (l.stage in ('seven_days', 'last_24h') or (l.stage = 'passed' and p_passed_email))
    end
    and not exists (
      select 1 from public.notification_deliveries d
      where d.dedupe_key = concat_ws(':', 'deadline-v2', channel.name, l.profile_id, l.kind, l.id, to_char(l.deadline, 'YYYY-MM-DD'), l.stage)
    )
    order by (l.stage in ('last_24h', 'day_of')) desc, (l.application_status is not null) desc, l.deadline, l.id, l.profile_id
    limit 500
  ) c
  on conflict (dedupe_key) do nothing
  returning channel
  )
  select coalesce(sum(total), 0), coalesce(bool_or(total = 500), false)
    into v_generated, v_discovery_cap
  from (select count(*) as total from created group by channel) counts;

  -- Inbox creation and fulfilment commit together, including recovery after crashes.
  with ready as (
    select d.id, d.profile_id, d.scholarship_id, d.opportunity_id, l.title, d.deadline_date,
      d.deadline_stage, d.dedupe_key
    from public.notification_deliveries d
    join public.profiles p on p.id = d.profile_id and p.deadline_in_app_enabled
    join public.deadline_tracked_listings l on l.profile_id = d.profile_id and l.deadline = d.deadline_date
      and l.id = coalesce(d.scholarship_id, d.opportunity_id)
      and l.kind = case when d.scholarship_id is not null then 'scholarship' else 'opportunity' end
    where d.campaign_key = 'deadline_reminder_v2' and d.channel = 'in_app' and d.status = 'pending'
      and d.deadline_stage = public.deadline_stage_at(d.deadline_date, now(), p_early, p_push)
      and (l.opens_at is null or l.opens_at <= least(v_today, l.deadline))
      and (l.last_cycle_closed_at is null or l.last_cycle_closed_at > v_today)
    order by (d.deadline_stage in ('last_24h', 'day_of')) desc, d.created_at, d.id
    limit 500 for update of d skip locked
  ), inserted as (
    insert into public.notifications (profile_id, scholarship_id, opportunity_id, type, metadata)
    select profile_id, scholarship_id, opportunity_id, 'deadline_reminder',
      jsonb_build_object('title', title, 'deadline', deadline_date, 'deadline_stage', deadline_stage,
                         'dedupe_key', dedupe_key)
    from ready
    returning metadata->>'dedupe_key' as key
  )
  update public.notification_deliveries d
  set status = 'delivered', sent_at = now()
  from inserted where d.dedupe_key = inserted.key;
  get diagnostics v_inbox_count = row_count;

  insert into public.deadline_reminder_run (started_at, generated) values (now(), v_generated)
  on conflict (id) do update set started_at = excluded.started_at, generated = excluded.generated;
  return jsonb_build_object('generated', v_generated, 'inboxDelivered', v_inbox_count,
    'capacityReached', v_discovery_cap or v_inbox_count = 500);
end;
$$;

create function public.claim_deadline_reminders(
  p_channel text, p_early integer, p_push integer, p_passed_email boolean,
  p_daily_limit integer, p_monthly_limit integer
)
returns table (id uuid, profile_id uuid, scholarship_id uuid, opportunity_id uuid, title text,
  deadline_date date, deadline_stage text, application_status text, full_name text,
  email text, attempts integer, lease_until timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_today date;
  v_clock timestamptz;
  v_rows integer;
begin
  if p_channel not in ('email', 'push') then return; end if;
  -- Serialize bundle selection per channel. The email lock also makes quota
  -- reservation and priority ordering atomic across concurrent cron calls.
  perform pg_advisory_xact_lock(72418613, case p_channel when 'email' then 2 else 3 end);
  v_clock := clock_timestamp();
  v_today := (v_clock at time zone 'Africa/Lagos')::date;
  if p_channel = 'email' and (
    (select count(*) from public.deadline_email_attempts a
      where a.reserved_at >= date_trunc('day', v_clock, 'UTC')) >= p_daily_limit
    or (select count(*) from public.deadline_email_attempts a
      where a.reserved_at >= date_trunc('month', v_clock, 'UTC')) >= p_monthly_limit
  ) then return; end if;

  return query
  with ready as materialized (
    select d.id, d.profile_id, d.deadline_stage, l.title, l.application_status, p.full_name, u.email::text as email,
      d.deadline_date, d.created_at
    from public.notification_deliveries d
    join public.profiles p on p.id = d.profile_id
    join public.deadline_tracked_listings l on l.profile_id = d.profile_id and l.deadline = d.deadline_date
      and l.id = coalesce(d.scholarship_id, d.opportunity_id)
      and l.kind = case when d.scholarship_id is not null then 'scholarship' else 'opportunity' end
    left join auth.users u on p_channel = 'email' and u.id = d.profile_id
    where d.campaign_key = 'deadline_reminder_v2' and d.channel = p_channel
      and d.available_at <= v_clock and d.attempts < 3
      and (d.status in ('pending', 'retryable')
        or (p_channel = 'push' and d.status = 'leased' and d.lease_until <= v_clock))
      and d.deadline_stage = public.deadline_stage_at(d.deadline_date, v_clock, p_early, p_push)
      and (l.opens_at is null or l.opens_at <= least(v_today, l.deadline))
      and (l.last_cycle_closed_at is null or l.last_cycle_closed_at > v_today)
      and case p_channel
        when 'email' then p.deadline_email_enabled and nullif(u.email, '') is not null
          and u.email_confirmed_at is not null and (d.deadline_stage <> 'passed' or p_passed_email)
        when 'push' then p.deadline_push_enabled
      end
  ), first_recipient as (
    select r.profile_id, r.deadline_stage from ready r
    order by (r.deadline_stage in ('last_24h', 'day_of')) desc, (r.application_status is not null) desc,
      r.deadline_date, r.created_at, r.id limit 1
  ), bundle as (
    select r.* from ready r join first_recipient f
      on f.profile_id = r.profile_id and f.deadline_stage = r.deadline_stage
    order by r.deadline_date, r.created_at, r.id limit 12
  )
  update public.notification_deliveries d
  set status = 'leased', attempts = d.attempts + 1, lease_until = v_clock + interval '10 minutes'
  from bundle b where d.id = b.id
    and (d.status in ('pending', 'retryable')
      or (p_channel = 'push' and d.status = 'leased' and d.lease_until <= v_clock))
  returning d.id, d.profile_id, d.scholarship_id, d.opportunity_id, b.title, d.deadline_date,
    d.deadline_stage, b.application_status, b.full_name, b.email, d.attempts, d.lease_until;

  get diagnostics v_rows = row_count;
  if p_channel = 'email' and v_rows > 0 then
    insert into public.deadline_email_attempts (reserved_at) values (v_clock);
  end if;
end;
$$;

-- Surface urgent work that is still outstanding after the bounded drain.
create function public.deadline_reminder_backlog(p_early integer, p_push integer, p_email boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'inApp', count(*) filter (where d.channel = 'in_app'),
    'push', count(*) filter (where d.channel = 'push'),
    'email', count(*) filter (where d.channel = 'email'),
    'dailyEmailAttempts', (select count(*) from public.deadline_email_attempts
      where reserved_at >= date_trunc('day', now(), 'UTC')),
    'monthlyEmailAttempts', (select count(*) from public.deadline_email_attempts
      where reserved_at >= date_trunc('month', now(), 'UTC'))
  )
  from public.notification_deliveries d
  join public.profiles p on p.id = d.profile_id
  join public.deadline_tracked_listings l on l.profile_id = d.profile_id and l.deadline = d.deadline_date
    and l.id = coalesce(d.scholarship_id, d.opportunity_id)
    and l.kind = case when d.scholarship_id is not null then 'scholarship' else 'opportunity' end
  where d.campaign_key = 'deadline_reminder_v2'
    and d.deadline_stage in ('last_24h', 'day_of')
    and d.deadline_stage = public.deadline_stage_at(d.deadline_date, now(), p_early, p_push)
    and d.status in ('pending', 'retryable', 'leased')
    and (l.opens_at is null or l.opens_at <= (now() at time zone 'Africa/Lagos')::date)
    and (l.last_cycle_closed_at is null or l.last_cycle_closed_at > (now() at time zone 'Africa/Lagos')::date)
    and case d.channel
      when 'in_app' then p.deadline_in_app_enabled
      when 'push' then p.deadline_push_enabled
      when 'email' then p_email and p.deadline_email_enabled and exists (
        select 1 from auth.users u where u.id = p.id and u.email_confirmed_at is not null
          and nullif(u.email, '') is not null)
    end;
$$;

create function public.deadline_reminder_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'last_run', (select jsonb_build_object('started_at', r.started_at, 'generated', r.generated)
      from public.deadline_reminder_run r),
    'deliveries', (select coalesce(jsonb_object_agg(s.channel, s.states), '{}'::jsonb) from (
      select channel, jsonb_object_agg(status, total) as states from (
        select channel, status, count(*) as total
        from public.notification_deliveries
        where campaign_key = 'deadline_reminder_v2'
          and (created_at >= now() - interval '30 days' or status in ('pending', 'retryable', 'leased'))
        group by channel, status
      ) totals group by channel
    ) s),
    'daily_email_attempts', (select count(*) from public.deadline_email_attempts
      where reserved_at >= date_trunc('day', now(), 'UTC')),
    'monthly_email_attempts', (select count(*) from public.deadline_email_attempts
      where reserved_at >= date_trunc('month', now(), 'UTC'))
  );
$$;

revoke all on function public.deadline_stage_at(date, timestamptz, integer, integer),
  public.prepare_deadline_reminders(integer, integer, boolean, boolean),
  public.claim_deadline_reminders(text, integer, integer, boolean, integer, integer),
  public.deadline_reminder_backlog(integer, integer, boolean),
  public.deadline_reminder_stats() from public, anon, authenticated;
grant execute on function public.prepare_deadline_reminders(integer, integer, boolean, boolean),
  public.claim_deadline_reminders(text, integer, integer, boolean, integer, integer),
  public.deadline_reminder_backlog(integer, integer, boolean),
  public.deadline_reminder_stats() to service_role;
