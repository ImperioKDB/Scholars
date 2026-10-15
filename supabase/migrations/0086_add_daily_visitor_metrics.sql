-- Daily visitor monitoring.
-- Stores only an opaque visitor key, day-level counts, and timestamps.
-- No IP addresses, user agents, or raw personal identifiers are persisted.
create table if not exists public.visitor_daily_metrics (
  day date not null,
  visitor_key text not null,
  page_views integer not null default 1 check (page_views > 0),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (day, visitor_key)
);

alter table public.visitor_daily_metrics enable row level security;

revoke all on public.visitor_daily_metrics from anon, authenticated;

grant select on public.visitor_daily_metrics to service_role;
grant insert, update on public.visitor_daily_metrics to service_role;

-- Backfill the first-party page-view history already present in events.
-- Prefixing profile IDs prevents collision with future opaque cookie keys.
insert into public.visitor_daily_metrics (day, visitor_key, page_views, first_seen, last_seen)
select
  (e.created_at at time zone 'UTC')::date,
  'profile:' || e.profile_id::text,
  count(*)::integer,
  min(e.created_at),
  max(e.created_at)
from public.events e
where e.event = 'page_viewed'
  and e.profile_id is not null
group by 1, 2
on conflict (day, visitor_key) do update set
  page_views = excluded.page_views,
  first_seen = least(public.visitor_daily_metrics.first_seen, excluded.first_seen),
  last_seen = greatest(public.visitor_daily_metrics.last_seen, excluded.last_seen);

create or replace function public.record_visitor_page_view(
  p_visitor_key text,
  p_seen_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  if p_visitor_key is null or p_visitor_key !~ '^(profile|cookie):[A-Za-z0-9_-]{1,128}$' then
    raise exception 'Invalid visitor key';
  end if;
  if p_seen_at is null then
    p_seen_at := now();
  end if;
  v_day := (p_seen_at at time zone 'UTC')::date;
  insert into public.visitor_daily_metrics (day, visitor_key, page_views, first_seen, last_seen)
  values (v_day, p_visitor_key, 1, p_seen_at, p_seen_at)
  on conflict (day, visitor_key) do update set
    page_views = public.visitor_daily_metrics.page_views + 1,
    last_seen = greatest(public.visitor_daily_metrics.last_seen, excluded.last_seen);
end;
$$;

revoke all on function public.record_visitor_page_view(text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_visitor_page_view(text, timestamptz) to service_role;

create or replace function public.get_daily_visitor_metrics(
  p_since timestamptz default now() - interval '30 days',
  p_until timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admin access required';
  end if;
  if p_since is null or p_until is null or p_since >= p_until then
    raise exception 'Invalid visitor metrics date range';
  end if;
  with daily as (
    select
      to_char(day, 'YYYY-MM-DD') as day,
      count(*)::integer as visitors,
      coalesce(sum(page_views), 0)::integer as page_views
    from public.visitor_daily_metrics
    where day >= (p_since at time zone 'UTC')::date
      and day < (p_until at time zone 'UTC')::date + 1
    group by day
    order by day
  )
  select jsonb_build_object(
    'window', jsonb_build_object('since', p_since, 'until', p_until),
    'total_visitors', coalesce((select count(distinct visitor_key)::integer from public.visitor_daily_metrics where day >= (p_since at time zone 'UTC')::date and day < (p_until at time zone 'UTC')::date + 1), 0),
    'total_page_views', coalesce((select sum(page_views)::integer from public.visitor_daily_metrics where day >= (p_since at time zone 'UTC')::date and day < (p_until at time zone 'UTC')::date + 1), 0),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily)) from daily), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_daily_visitor_metrics(timestamptz, timestamptz) from public;
grant execute on function public.get_daily_visitor_metrics(timestamptz, timestamptz) to authenticated;
