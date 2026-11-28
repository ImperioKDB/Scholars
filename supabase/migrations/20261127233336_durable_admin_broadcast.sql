-- The existing notification lease is intentionally not used for dispatch.
-- An expired lease after a committed dispatch intent is an uncertain outcome.
create schema if not exists broadcast_private;
revoke all on schema broadcast_private from public, anon, authenticated;
grant usage on schema broadcast_private to service_role;

create table public.broadcast_campaigns (
  id uuid primary key,
  created_by uuid not null,
  batch text check (batch in ('A', 'B', 'C')),
  fingerprint text not null,
  content jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz
);
create unique index broadcast_active_selection on public.broadcast_campaigns (fingerprint)
  where completed_at is null;
create index broadcast_recent on public.broadcast_campaigns (created_at desc);

create table public.broadcast_submissions (
  id uuid primary key,
  campaign_id uuid not null references public.broadcast_campaigns(id),
  created_by uuid not null,
  request jsonb not null,
  created_at timestamptz not null default statement_timestamp()
);
create index broadcast_submissions_admin_recent on public.broadcast_submissions (created_by, created_at desc);

create table public.broadcast_targets (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.broadcast_campaigns(id),
  recipient_id uuid not null,
  channel text not null check (channel in ('email', 'push')),
  transport text not null check (transport in ('email', 'expo', 'web')),
  source_id uuid not null,
  -- Push targets store an identity digest, while keys remain in the subscription table.
  address text,
  first_name text,
  destination_digest text,
  status text not null default 'queued'
    check (status in ('queued', 'reserved', 'dispatching', 'accepted', 'failed', 'uncertain', 'quota_deferred', 'unattempted')),
  available_at timestamptz not null default statement_timestamp(),
  attempts integer not null default 0,
  attempt_id uuid,
  lease_token uuid,
  provider_key text,
  provider_message_id text,
  next_provider text check (next_provider = 'resend'),
  reason text,
  brevo_rejection text,
  bookkeeping_error boolean not null default false,
  unique (campaign_id, transport, source_id)
);
create index broadcast_targets_due on public.broadcast_targets (campaign_id, channel, available_at, id)
  where status in ('queued', 'quota_deferred');
create index broadcast_targets_claimed on public.broadcast_targets (campaign_id, channel)
  where status in ('reserved', 'dispatching');
create index broadcast_targets_profiles on public.broadcast_targets (campaign_id, recipient_id)
  where channel = 'push';

-- Operators record verified credit allocations for each provider period.
-- An absent, exhausted or overlapping window holds that provider.
create table public.broadcast_provider_windows (
  provider text not null check (provider in ('brevo', 'resend')),
  period text not null check (period in ('daily', 'monthly')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  allowance integer not null,
  reserved integer not null default 0 check (reserved >= 0),
  primary key (provider, period, starts_at),
  check (ends_at > starts_at),
  check (
    (period = 'daily' and ends_at - starts_at <= interval '25 hours'
      and allowance between 0 and case provider when 'brevo' then 300 else 100 end)
    or (provider = 'resend' and period = 'monthly' and ends_at - starts_at <= interval '32 days'
      and allowance between 0 and 3000)
  )
);
create table public.broadcast_provider_state (
  provider_key text primary key,
  next_at timestamptz not null default '-infinity',
  consecutive_uncertain integer not null default 0
);

alter table public.broadcast_campaigns enable row level security;
alter table public.broadcast_submissions enable row level security;
alter table public.broadcast_targets enable row level security;
alter table public.broadcast_provider_windows enable row level security;
alter table public.broadcast_provider_state enable row level security;
revoke all on public.broadcast_campaigns, public.broadcast_submissions, public.broadcast_targets,
  public.broadcast_provider_windows, public.broadcast_provider_state from public, anon, authenticated;
grant select, insert, update on public.broadcast_campaigns, public.broadcast_submissions,
  public.broadcast_targets, public.broadcast_provider_windows, public.broadcast_provider_state to service_role;
revoke all on sequence public.broadcast_targets_id_seq from public, anon, authenticated;
grant usage on sequence public.broadcast_targets_id_seq to service_role;

create index broadcast_job_due on public.workflow_jobs (kind, available_at, id)
  where kind in ('broadcast_email', 'broadcast_push') and status in ('pending', 'retryable', 'leased');
create unique index broadcast_job_channel on public.workflow_jobs (correlation_id, kind)
  where kind in ('broadcast_email', 'broadcast_push');

create function broadcast_private.assert_admin(p_admin uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_admin and is_admin is true) then
    raise exception using errcode = '42501', message = 'admin required';
  end if;
end;
$$;

create function broadcast_private.destination_digest(p_value text) returns text
language sql immutable strict set search_path = '' as $$
  select encode(sha256(convert_to(p_value, 'UTF8')), 'hex');
$$;

create function broadcast_private.email_is_current(p_recipient uuid, p_address text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = p_recipient and email = p_address);
$$;

create function broadcast_private.is_historical(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select p_id in ('f3b105fa-8ad2-4e1f-a752-d444ed98c11b', '746a5c6e-fcdf-48b2-9f24-a044491ed74c')
    or exists (select 1 from public.broadcast_delivery_log where broadcast_id = p_id)
    or exists (
      select 1 from public.notification_deliveries
      where dedupe_key like 'admin-broadcast-push:' || p_id::text || ':%'
        and campaign_key = 'admin_broadcast' and schedule_bucket = p_id::text
    );
$$;

create function broadcast_private.overview(p_admin uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform broadcast_private.assert_admin(p_admin);
  return jsonb_build_object(
    'recipientCount', (select count(*) from auth.users where nullif(email, '') is not null),
    'pushRecipientCount', (select count(*) from (
      select profile_id from public.push_tokens where enabled
      union select profile_id from public.web_push_subscriptions where enabled
    ) audience),
    'recent', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb) from (
      select id, batch, created_at, completed_at from public.broadcast_campaigns order by created_at desc limit 10
    ) c)
  );
end;
$$;

create function public.broadcast_overview(p_admin uuid) returns jsonb
language sql stable set search_path = '' as $$
  select broadcast_private.overview(p_admin);
$$;

-- Serialize creation briefly to protect identical selections across admins and
-- resolve alternate submission IDs to the same active campaign.
create function broadcast_private.enqueue(
  p_admin uuid, p_id uuid, p_scholarships uuid[], p_opportunities uuid[], p_batch text, p_base_url text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request jsonb := jsonb_build_array(p_batch, p_scholarships, p_opportunities);
  v_fingerprint text;
  v_existing public.broadcast_submissions%rowtype;
  v_campaign uuid;
  v_items jsonb;
  v_limit integer := case when p_batch is not null then 300 end;
  v_offset integer := case p_batch when 'B' then 300 when 'C' then 600 else 0 end;
begin
  perform broadcast_private.assert_admin(p_admin);
  if p_id is null or coalesce(cardinality(p_scholarships) + cardinality(p_opportunities), 0) not between 1 and 10
    or (p_batch is not null and p_batch not in ('A','B','C'))
    or length(p_base_url) > 512 or p_base_url is null then
    raise exception using errcode = 'P0400', message = 'invalid campaign';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('scholars:admin-broadcast:enqueue', 0));
  if broadcast_private.is_historical(p_id) then
    raise exception using errcode = 'P0409', message = 'historical campaign';
  end if;
  select * into v_existing from public.broadcast_submissions where id = p_id;
  if found then
    if v_existing.request <> v_request then
      raise exception using errcode = 'P0409', message = 'submission key already used';
    end if;
    return v_existing.campaign_id;
  end if;
  if (
    select count(*) from public.broadcast_submissions
    where created_by = p_admin and created_at > statement_timestamp() - interval '1 minute'
  ) >= 3 then
    raise exception using errcode = 'P0429', message = 'submission rate limit';
  end if;
  v_fingerprint := broadcast_private.destination_digest(jsonb_build_array(
    p_batch,
    array(select distinct value from unnest(p_scholarships) value order by value),
    array(select distinct value from unnest(p_opportunities) value order by value)
  )::text);
  select id into v_campaign from public.broadcast_campaigns
    where fingerprint = v_fingerprint and completed_at is null for update;
  if found then
    insert into public.broadcast_submissions (id, campaign_id, created_by, request)
      values (p_id, v_campaign, p_admin, v_request);
    return v_campaign;
  end if;

  select jsonb_agg(to_jsonb(items) - 'position' order by position) into v_items from (
    select s.id, left(s.title, 512) as title, left(s.provider_name, 512) as provider_name,
      left(s.amount, 512) as amount, s.deadline, 'scholarship' as kind, 'Scholarship' as kind_label,
      case when s.slug is not null then rtrim(p_base_url, '/') || '/scholarship/' || left(s.slug, 512)
        else rtrim(p_base_url, '/') || '/discover' end as url, array_position(p_scholarships, s.id) as position
    from public.scholarships s where s.verified and s.id = any(p_scholarships)
    union all
    select o.id, left(o.title, 512), left(o.provider_name, 512), left(o.compensation, 512), o.deadline,
      'opportunity', case o.type::text when 'fellowship' then 'Fellowship' when 'internship' then 'Internship'
        when 'competition' then 'Competition' when 'mentorship' then 'Mentorship' else 'Opportunity' end,
      case when o.slug is not null then rtrim(p_base_url, '/') || '/opportunity/' || left(o.slug, 512)
        else rtrim(p_base_url, '/') || '/discover' end,
      cardinality(p_scholarships) + array_position(p_opportunities, o.id)
    from public.opportunities o where o.verified and o.id = any(p_opportunities)
  ) items;
  if v_items is null or octet_length(v_items::text) > 20000 then
    raise exception using errcode = 'P0400', message = 'no verified listings';
  end if;

  insert into public.broadcast_campaigns (id, created_by, batch, fingerprint, content)
    values (p_id, p_admin, p_batch, v_fingerprint,
      jsonb_build_object('version', 1, 'items', v_items, 'baseUrl', rtrim(p_base_url, '/')));
  insert into public.broadcast_submissions (id, campaign_id, created_by, request)
    values (p_id, p_id, p_admin, v_request);

  with audience as (
    select id, email, raw_user_meta_data from auth.users where nullif(email, '') is not null
    order by id limit v_limit offset v_offset
  ), ranked as (
    select *, row_number() over (partition by lower(btrim(email)) order by id) as address_rank from audience
  )
  insert into public.broadcast_targets
    (campaign_id, recipient_id, channel, transport, source_id, address, first_name, status, reason)
  select p_id, u.id, 'email', 'email', u.id, u.email, left(
    coalesce(nullif(split_part(regexp_replace(btrim(u.raw_user_meta_data ->> 'full_name'), '\s+', ' ', 'g'), ' ', 1), ''),
      split_part(u.email, '@', 1)), 200),
    case when address_rank = 1 then 'queued' else 'unattempted' end,
    case when address_rank > 1 then 'duplicate_address' end
  from ranked u order by u.id;
  if not found then
    raise exception using errcode = 'P0400', message = 'empty email audience';
  end if;

  with devices as (
    select t.profile_id, t.id, 'expo'::text as transport, broadcast_private.destination_digest(t.expo_push_token) as digest
      from public.push_tokens t where t.enabled
    union all
    select s.profile_id, s.id, 'web', broadcast_private.destination_digest(s.endpoint)
      from public.web_push_subscriptions s where s.enabled
  ), eligible as (
    select d.*, row_number() over (partition by d.transport, d.digest order by d.profile_id, d.id) as destination_rank
    from devices d
    where p_batch is null or exists (
      select 1 from public.broadcast_targets t where t.campaign_id = p_id and t.transport = 'email' and t.source_id = d.profile_id
    )
  )
  insert into public.broadcast_targets
    (campaign_id, recipient_id, channel, transport, source_id, destination_digest, status, reason)
  select p_id, profile_id, 'push', transport, id, digest,
    case when destination_rank = 1 then 'queued' else 'unattempted' end,
    case when destination_rank > 1 then 'duplicate_device' end
  from eligible;
  if (select count(distinct recipient_id) from public.broadcast_targets where campaign_id = p_id and channel = 'push') > 2000 then
    raise exception using errcode = 'P0400', message = 'push audience exceeds limit';
  end if;

  insert into public.notification_deliveries
    (profile_id, campaign_key, channel, schedule_bucket, dedupe_key, template_version, status)
  select recipient_id, 'admin_broadcast_v2', 'push', p_id::text,
    'admin-broadcast-v2:' || p_id::text || ':' || recipient_id::text, 'admin-broadcast-push-v1',
    case when bool_or(status = 'queued') then 'pending' else 'suppressed' end
  from public.broadcast_targets where campaign_id = p_id and channel = 'push'
  group by recipient_id;

  insert into public.workflow_jobs (kind, idempotency_key, correlation_id)
  select 'broadcast_' || channel, 'broadcast-v2:' || p_id::text || ':' || channel, p_id
  from public.broadcast_targets where campaign_id = p_id and status = 'queued' group by channel;
  return p_id;
end;
$$;

create function broadcast_private.counts(p_states text[], p_errors boolean[]) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'total', count(*),
    'queued', count(*) filter (where state = 'queued'),
    'processing', count(*) filter (where state in ('reserved','dispatching')),
    'accepted', count(*) filter (where state = 'accepted'),
    'failed', count(*) filter (where state = 'failed'),
    'uncertain', count(*) filter (where state = 'uncertain'),
    'quota_deferred', count(*) filter (where state = 'quota_deferred'),
    'unattempted', count(*) filter (where state = 'unattempted'),
    'bookkeeping_errors', count(*) filter (where bookkeeping_error)
  ) from unnest(p_states, p_errors) as u(state, bookkeeping_error);
$$;

create function public.broadcast_status(p_admin uuid, p_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_result jsonb;
begin
  perform broadcast_private.assert_admin(p_admin);
  select jsonb_build_object(
    'id', c.id, 'batch', c.batch, 'created_at', c.created_at, 'completed_at', c.completed_at,
    'email', (
      select broadcast_private.counts(array_agg(status), array_agg(bookkeeping_error))
      from public.broadcast_targets where campaign_id = c.id and channel = 'email'
    ),
    'push_devices', (
      select broadcast_private.counts(array_agg(status), array_agg(bookkeeping_error))
      from public.broadcast_targets where campaign_id = c.id and channel = 'push'
    ),
    'push_profiles', (
      select broadcast_private.counts(array_agg(state), array_agg(bookkeeping_error)) from (
        select
          case
            when bool_or(status = 'accepted') then 'accepted'
            when bool_or(status in ('reserved','dispatching')) then 'dispatching'
            when bool_or(status = 'queued') then 'queued'
            when bool_or(status = 'quota_deferred') then 'quota_deferred'
            when bool_or(status = 'uncertain') then 'uncertain'
            when bool_or(status = 'failed') then 'failed'
            else 'unattempted'
          end as state,
          bool_or(bookkeeping_error) as bookkeeping_error
        from public.broadcast_targets where campaign_id = c.id and channel = 'push'
        group by recipient_id
      ) p
    ),
    'email_next_at', (select available_at from public.workflow_jobs where correlation_id = c.id
      and kind = 'broadcast_email' and status = 'retryable'),
    'push_next_at', (select available_at from public.workflow_jobs where correlation_id = c.id
      and kind = 'broadcast_push' and status = 'retryable'),
    'email_hold', (select reason from public.broadcast_targets where campaign_id = c.id and channel = 'email'
      and status = 'quota_deferred' order by available_at, id limit 1),
    'push_hold', (select reason from public.broadcast_targets where campaign_id = c.id and channel = 'push'
      and status = 'quota_deferred' order by available_at, id limit 1)
  ) into v_result
  from public.broadcast_campaigns c
  where c.id = coalesce((select campaign_id from public.broadcast_submissions where id = p_id), p_id);
  return v_result;
end;
$$;

create function public.broadcast_enqueue(
  p_admin uuid, p_id uuid, p_scholarships uuid[], p_opportunities uuid[], p_batch text, p_base_url text
) returns jsonb language plpgsql set search_path = '' as $$
declare v_campaign uuid;
begin
  v_campaign := broadcast_private.enqueue(p_admin, p_id, p_scholarships, p_opportunities, p_batch, p_base_url);
  return public.broadcast_status(p_admin, v_campaign);
end;
$$;

create function public.broadcast_due_jobs() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', due.id, 'channel', substr(due.kind, 11))), '[]'::jsonb)
  from (values ('broadcast_email'), ('broadcast_push')) as lane(kind)
  cross join lateral (
    select job.id, job.kind from public.workflow_jobs job
    join public.broadcast_campaigns c on c.id = job.correlation_id
    where job.kind = lane.kind and c.completed_at is null and job.available_at <= statement_timestamp()
      and (job.status in ('pending', 'retryable') or (job.status = 'leased' and job.lease_until <= statement_timestamp()))
    order by job.available_at, job.id limit 1
  ) due;
$$;

create function broadcast_private.refresh_push_profile(p_campaign uuid, p_recipient uuid) returns void
language sql set search_path = '' as $$
  update public.notification_deliveries n set status = outcomes.state,
    sent_at = case when outcomes.state = 'accepted' then coalesce(n.sent_at, statement_timestamp()) end,
    attempts = outcomes.attempts
  from (
    select case
      when bool_or(status = 'accepted') then 'accepted'
      when bool_or(status in ('queued','quota_deferred','reserved','dispatching')) then 'pending'
      when bool_or(status = 'uncertain') then 'dead_letter'
      when bool_or(status = 'failed') then 'failed'
      else 'suppressed'
    end as state, coalesce(sum(attempts), 0) as attempts
    from public.broadcast_targets where campaign_id = p_campaign and recipient_id = p_recipient and channel = 'push'
  ) outcomes
  where n.dedupe_key = 'admin-broadcast-v2:' || p_campaign::text || ':' || p_recipient::text
    and n.campaign_key = 'admin_broadcast_v2';
$$;

create function public.broadcast_claim(p_job uuid, p_channel text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_job public.workflow_jobs%rowtype;
  v_target public.broadcast_targets%rowtype;
  v_token uuid := gen_random_uuid();
  v_device jsonb;
  v_recipient uuid;
begin
  select j.* into v_job from public.workflow_jobs j
    join public.broadcast_campaigns c on c.id = j.correlation_id
    where j.id = p_job and p_channel in ('email', 'push') and j.kind = 'broadcast_' || p_channel
      and c.completed_at is null and j.available_at <= statement_timestamp()
      and (j.status in ('pending','retryable') or (j.status = 'leased' and j.lease_until <= statement_timestamp()))
    for update of j skip locked;
  if not found then return null; end if;

  -- One reserved target per slice. Expired dispatches are never candidates.
  update public.broadcast_targets set status = 'queued', lease_token = null
    where campaign_id = v_job.correlation_id and channel = p_channel and status = 'reserved';
  update public.broadcast_targets set status = 'uncertain', reason = 'interrupted_dispatch', bookkeeping_error = true
    where campaign_id = v_job.correlation_id and channel = p_channel and status = 'dispatching'
    returning recipient_id into v_recipient;
  if found and p_channel = 'push' then
    begin
      perform broadcast_private.refresh_push_profile(v_job.correlation_id, v_recipient);
    exception when others then
      -- The target ledger is authoritative even if the legacy profile projection fails.
      null;
    end;
  end if;

  update public.workflow_jobs set status = 'leased', lease_until = statement_timestamp() + interval '45 seconds',
    attempts = attempts + 1, result_metadata = jsonb_build_object('lease_token', v_token)
    where id = p_job;
  select * into v_target from public.broadcast_targets
    where campaign_id = v_job.correlation_id and channel = p_channel
      and status in ('queued','quota_deferred') and available_at <= statement_timestamp()
    order by available_at, id limit 1 for update skip locked;
  if not found then return jsonb_build_object('token', v_token, 'target', null); end if;

  update public.broadcast_targets set status = 'reserved', lease_token = v_token where id = v_target.id;
  if v_target.transport = 'expo' then
    select jsonb_build_object('token', t.expo_push_token) into v_device from public.push_tokens t
      where t.id = v_target.source_id and t.profile_id = v_target.recipient_id and t.enabled
        and broadcast_private.destination_digest(t.expo_push_token) = v_target.destination_digest;
  elsif v_target.transport = 'web' then
    select jsonb_build_object('endpoint', s.endpoint, 'auth', s.auth, 'p256dh', s.p256dh) into v_device
      from public.web_push_subscriptions s
      where s.id = v_target.source_id and s.profile_id = v_target.recipient_id and s.enabled
        and broadcast_private.destination_digest(s.endpoint) = v_target.destination_digest;
  end if;

  return jsonb_build_object('token', v_token, 'campaign', v_job.correlation_id,
    'content', (select content from public.broadcast_campaigns where id = v_job.correlation_id),
    'target', jsonb_build_object('id', v_target.id::text, 'transport', v_target.transport, 'address', v_target.address,
      'first_name', v_target.first_name, 'device', v_device, 'next_provider', v_target.next_provider));
end;
$$;

create function broadcast_private.defer(
  p_target public.broadcast_targets, p_due timestamptz, p_reason text, p_provider text, p_entire_lane boolean
) returns void language sql set search_path = '' as $$
  update public.broadcast_targets set status = 'quota_deferred', available_at = greatest(available_at, p_due),
    reason = p_reason
  where campaign_id = p_target.campaign_id and channel = p_target.channel and (
    id = p_target.id or (
      p_entire_lane and channel = 'email' and status in ('queued','quota_deferred')
      and coalesce(next_provider, p_provider) = p_provider
      and (p_target.next_provider is null or next_provider is not null)
    )
  );
$$;

create function public.broadcast_begin(
  p_job uuid, p_token uuid, p_target bigint, p_provider text, p_skip_reason text default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_job public.workflow_jobs%rowtype;
  v_target public.broadcast_targets%rowtype;
  v_provider public.broadcast_provider_state%rowtype;
  v_window public.broadcast_provider_windows%rowtype;
  v_period text;
  v_window_count integer;
  v_daily timestamptz;
  v_monthly timestamptz;
  v_due timestamptz;
  v_now timestamptz := statement_timestamp();
  v_attempt uuid := gen_random_uuid();
  v_skip text := p_skip_reason;
begin
  select * into v_job from public.workflow_jobs
    where id = p_job and kind in ('broadcast_email','broadcast_push') and status = 'leased'
      and result_metadata ->> 'lease_token' = p_token::text and lease_until > v_now + interval '5 seconds'
    for update;
  if not found then return null; end if;
  select * into v_target from public.broadcast_targets
    where id = p_target and campaign_id = v_job.correlation_id and 'broadcast_' || channel = v_job.kind
      and status = 'reserved' and lease_token = p_token for update;
  if not found then return null; end if;

  if v_skip is null then
    if v_target.transport = 'email' and not broadcast_private.email_is_current(v_target.recipient_id, v_target.address) then
      v_skip := 'recipient_changed';
    elsif v_target.transport = 'expo' and not exists (
      select 1 from public.push_tokens t where t.id = v_target.source_id and t.profile_id = v_target.recipient_id and t.enabled
        and broadcast_private.destination_digest(t.expo_push_token) = v_target.destination_digest
    ) then
      v_skip := 'device_unavailable';
    elsif v_target.transport = 'web' and not exists (
      select 1 from public.web_push_subscriptions s
      where s.id = v_target.source_id and s.profile_id = v_target.recipient_id and s.enabled
        and broadcast_private.destination_digest(s.endpoint) = v_target.destination_digest
        and 'web:' || lower(regexp_replace(substring(s.endpoint from '^https://([^/?#]+)'), ':443$', '')) = p_provider
    ) then
      v_skip := 'device_unavailable';
    end if;
  end if;
  if v_skip is not null then
    if v_skip not in ('recipient_changed','device_unavailable','device_invalid','provider_not_configured') then
      raise exception using errcode = 'P0400', message = 'invalid skip reason';
    end if;
    update public.broadcast_targets set status = 'unattempted', reason = v_skip where id = p_target;
    if v_target.channel = 'push' then
      begin
        perform broadcast_private.refresh_push_profile(v_target.campaign_id, v_target.recipient_id);
      exception when others then
        update public.broadcast_targets set bookkeeping_error = true where id = p_target;
      end;
    end if;
    return null;
  end if;

  if p_provider is null
    or (v_target.transport = 'email' and (p_provider not in ('brevo','resend')
      or (v_target.next_provider is not null and p_provider <> v_target.next_provider)))
    or (v_target.transport = 'expo' and p_provider <> 'expo')
    or (v_target.transport = 'web' and p_provider !~ '^web:[a-z0-9.-]{1,253}$') then
    raise exception using errcode = 'P0400', message = 'invalid provider';
  end if;

  -- One provider-account lock covers every campaign using its allocation.
  insert into public.broadcast_provider_state (provider_key) values (p_provider) on conflict do nothing;
  select * into v_provider from public.broadcast_provider_state where provider_key = p_provider for update;
  if v_provider.next_at > v_now then
    perform broadcast_private.defer(v_target, v_provider.next_at, 'provider_cooldown', p_provider,
      v_provider.next_at > v_now + interval '5 seconds');
    return null;
  end if;
  if v_target.channel = 'email' then
    for v_period in select unnest(case p_provider when 'brevo' then array['daily'] else array['daily','monthly'] end) loop
      select count(*) into v_window_count from public.broadcast_provider_windows
        where provider = p_provider and period = v_period and starts_at <= v_now and ends_at > v_now;
      select * into v_window from public.broadcast_provider_windows
        where provider = p_provider and period = v_period and starts_at <= v_now and ends_at > v_now
        order by starts_at limit 1 for update;
      if v_window_count <> 1 or v_window.reserved >= v_window.allowance then
        select min(starts_at) into v_due from public.broadcast_provider_windows
          where provider = p_provider and period = v_period and starts_at > v_now;
        v_due := coalesce(
          case when v_window_count = 1 then v_window.ends_at end,
          v_due, v_now + interval '1 minute'
        );
        perform broadcast_private.defer(v_target, v_due,
          case when v_window_count = 1 then v_period || '_quota' else 'allocation_unavailable' end,
          p_provider, true);
        return null;
      end if;
      if v_period = 'daily' then v_daily := v_window.starts_at; else v_monthly := v_window.starts_at; end if;
    end loop;
    update public.broadcast_provider_windows set reserved = reserved + 1
      where provider = p_provider and ((period = 'daily' and starts_at = v_daily)
        or (period = 'monthly' and starts_at = v_monthly));
  end if;

  update public.broadcast_provider_state set next_at = v_now + interval '1 second' where provider_key = p_provider;
  update public.broadcast_targets set status = 'dispatching', attempts = attempts + 1,
    attempt_id = v_attempt, provider_key = p_provider, reason = null
  where id = p_target;
  return jsonb_build_object('attempt', v_attempt, 'lease_until', v_job.lease_until);
end;
$$;

create function public.broadcast_finalize(
  p_target bigint, p_attempt uuid, p_outcome text, p_provider_id text, p_reason text, p_retry_seconds integer
) returns boolean language plpgsql set search_path = '' as $$
declare
  v_target public.broadcast_targets%rowtype;
  v_due timestamptz;
begin
  if p_attempt is null or p_outcome is null
    or p_outcome not in ('accepted','failed','uncertain','deferred','fallback')
    or length(p_provider_id) > 256 or length(p_reason) > 80 then
    raise exception using errcode = 'P0400', message = 'invalid outcome';
  end if;
  select * into v_target from public.broadcast_targets
    where id = p_target and attempt_id = p_attempt for update;
  if not found then return false; end if;
  -- A repeated acknowledgement is harmless. An observation can resolve an
  -- interrupted intent during lease recovery only when it owns that intent.
  if v_target.status <> 'dispatching' and not (
    v_target.status = 'uncertain' and v_target.reason = 'interrupted_dispatch' and p_outcome in ('accepted','failed')
  ) then return true; end if;

  if p_outcome = 'deferred' then
    v_due := statement_timestamp() + make_interval(secs => greatest(1, coalesce(p_retry_seconds, 60)));
    if p_reason in ('daily_quota','monthly_quota') then
      select greatest(v_due, max(ends_at)) into v_due from public.broadcast_provider_windows
        where provider = v_target.provider_key and period || '_quota' = p_reason
          and starts_at <= statement_timestamp() and ends_at > statement_timestamp();
    end if;
    update public.broadcast_provider_state set next_at = greatest(next_at, v_due)
      where provider_key = v_target.provider_key;
    perform broadcast_private.defer(v_target, v_due, p_reason, v_target.provider_key,
      p_reason in ('daily_quota','monthly_quota'));
  elsif p_outcome = 'fallback' then
    if v_target.provider_key <> 'brevo' or p_reason not in ('brevo_http_401','brevo_http_403') then
      raise exception using errcode = 'P0400', message = 'unsafe fallback';
    end if;
    update public.broadcast_targets set status = 'queued', next_provider = 'resend',
      reason = p_reason, brevo_rejection = p_reason, available_at = statement_timestamp()
    where id = p_target;
  else
    update public.broadcast_targets set status = p_outcome, provider_message_id = p_provider_id, reason = p_reason
      where id = p_target;
    if p_outcome = 'uncertain' then
      update public.broadcast_provider_state set consecutive_uncertain = consecutive_uncertain + 1,
        next_at = greatest(
          next_at,
          statement_timestamp() + make_interval(secs => greatest(0, coalesce(p_retry_seconds, 0))),
          case when consecutive_uncertain >= 2 then statement_timestamp() + interval '15 minutes' end
        )
      where provider_key = v_target.provider_key;
    elsif p_outcome = 'accepted' then
      update public.broadcast_provider_state set consecutive_uncertain = 0
      where provider_key = v_target.provider_key and consecutive_uncertain > 0;
    end if;
  end if;

  -- Save the outcome before best-effort historical side effects. Failure of a
  -- projection or cleanup must never turn provider acceptance into a resend.
  begin
    if v_target.channel = 'email' and p_outcome = 'accepted' then
      insert into public.announcement_log (profile_id, listing_kind, listing_id)
      select p.id, item ->> 'kind', (item ->> 'id')::uuid
      from public.broadcast_campaigns c
      cross join lateral jsonb_array_elements(c.content -> 'items') as i(item)
      join public.profiles p on p.id = v_target.recipient_id
      where c.id = v_target.campaign_id on conflict do nothing;
    elsif v_target.channel = 'push' then
      perform broadcast_private.refresh_push_profile(v_target.campaign_id, v_target.recipient_id);
      if p_outcome = 'failed' and p_reason = 'device_gone' then
        if v_target.transport = 'expo' then
          update public.push_tokens set enabled = false
            where id = v_target.source_id and profile_id = v_target.recipient_id
              and broadcast_private.destination_digest(expo_push_token) = v_target.destination_digest;
        else
          update public.web_push_subscriptions set enabled = false
            where id = v_target.source_id and profile_id = v_target.recipient_id
              and broadcast_private.destination_digest(endpoint) = v_target.destination_digest;
        end if;
      end if;
    end if;
  exception when others then
    update public.broadcast_targets set bookkeeping_error = true where id = p_target;
  end;
  return true;
end;
$$;

create function public.broadcast_release(p_job uuid, p_token uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_job public.workflow_jobs%rowtype;
  v_campaign uuid;
  v_due timestamptz;
  v_channel text;
begin
  select correlation_id into v_campaign from public.workflow_jobs
    where id = p_job and kind in ('broadcast_email','broadcast_push');
  if not found then return null; end if;
  -- Serialize completion across the two lanes, while dispatch remains independent.
  perform 1 from public.broadcast_campaigns where id = v_campaign for update;
  if not found then return null; end if;
  select * into v_job from public.workflow_jobs
    where id = p_job and status = 'leased' and result_metadata ->> 'lease_token' = p_token::text for update;
  if not found then return null; end if;
  v_channel := substr(v_job.kind, 11);
  if exists (select 1 from public.broadcast_targets
    where campaign_id = v_campaign and channel = v_channel and status = 'dispatching') then
    return null; -- Retain the lease for conservative recovery.
  end if;
  update public.broadcast_targets set status = 'queued', lease_token = null
    where campaign_id = v_campaign and channel = v_channel and status = 'reserved';
  select min(available_at) into v_due from public.broadcast_targets
    where campaign_id = v_campaign and channel = v_channel and status in ('queued','quota_deferred');
  update public.workflow_jobs set status = case when v_due is null then 'succeeded' else 'retryable' end,
    available_at = coalesce(v_due, statement_timestamp()), lease_until = null, result_metadata = null,
    completed_at = case when v_due is null then statement_timestamp() end
    where id = p_job;
  if v_due is null and not exists (
    select 1 from public.workflow_jobs where correlation_id = v_campaign and kind in ('broadcast_email','broadcast_push')
      and status <> 'succeeded'
  ) then
    update public.broadcast_campaigns set completed_at = statement_timestamp() where id = v_campaign;
  end if;
  return jsonb_build_object('next_at', v_due);
end;
$$;

revoke all on all functions in schema broadcast_private from public, anon, authenticated;
grant execute on all functions in schema broadcast_private to service_role;

revoke all on function
  public.broadcast_overview(uuid),
  public.broadcast_enqueue(uuid, uuid, uuid[], uuid[], text, text),
  public.broadcast_status(uuid, uuid),
  public.broadcast_due_jobs(),
  public.broadcast_claim(uuid, text),
  public.broadcast_begin(uuid, uuid, bigint, text, text),
  public.broadcast_finalize(bigint, uuid, text, text, text, integer),
  public.broadcast_release(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.broadcast_overview(uuid),
  public.broadcast_enqueue(uuid, uuid, uuid[], uuid[], text, text),
  public.broadcast_status(uuid, uuid),
  public.broadcast_due_jobs(),
  public.broadcast_claim(uuid, text),
  public.broadcast_begin(uuid, uuid, bigint, text, text),
  public.broadcast_finalize(bigint, uuid, text, text, text, integer),
  public.broadcast_release(uuid, uuid)
to service_role;
