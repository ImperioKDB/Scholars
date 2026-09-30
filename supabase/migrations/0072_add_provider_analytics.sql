-- Provider-grade analytics over the existing first-party events pipeline.
-- Additive only: no tables, rows, or existing event systems are deleted.
-- Provider-facing output is aggregate-only and protected by is_admin(auth.uid()).

alter table public.profiles
  add column if not exists referral_source text,
  add column if not exists campaign_id text,
  add column if not exists ambassador_code text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

comment on column public.profiles.referral_source is 'Attribution source captured at signup; aggregate reporting only.';
comment on column public.profiles.campaign_id is 'Attribution campaign identifier captured at signup; aggregate reporting only.';
comment on column public.profiles.ambassador_code is 'Ambassador attribution code captured at signup; aggregate reporting only.';

create index if not exists idx_profiles_created_at on public.profiles (created_at);
create index if not exists idx_profiles_attribution on public.profiles (utm_source, utm_medium, utm_campaign);
create index if not exists idx_events_match_reporting on public.events (created_at, event) where event = 'match_viewed';

create or replace function public.get_provider_analytics(
  p_since timestamptz default now() - interval '30 days',
  p_until timestamptz default now(),
  p_scholarship_id uuid default null
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

  with
  profile_window as (
    select p.* from public.profiles p
    where p.created_at >= p_since and p.created_at < p_until
  ),
  daily_signups as (
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as signups
    from profile_window group by 1 order by 1
  ),
  active_days as (
    select profile_id, count(distinct date(created_at))::int as days_active
    from public.events
    where created_at >= greatest(p_since, p_until - interval '30 days') and created_at < p_until
    group by profile_id
  ),
  activation as (
    select
      count(*)::int as signups,
      count(*) filter (where profile_completeness = 100)::int as completed_profiles,
      count(*) filter (where exists (
        select 1 from public.events e
        where e.profile_id = profile_window.id
          and e.event = 'match_viewed'
          and e.created_at >= profile_window.created_at
          and e.created_at <= profile_window.created_at + interval '7 days'
      ))::int as viewed_match,
      count(*) filter (where profile_completeness = 100 and exists (
        select 1 from public.events e
        where e.profile_id = profile_window.id
          and e.event = 'match_viewed'
          and e.created_at >= profile_window.created_at
          and e.created_at <= profile_window.created_at + interval '7 days'
      ))::int as activated
    from profile_window
  ),
  retention as (
    select
      count(*)::int as cohort_size,
      count(*) filter (where exists (select 1 from public.events e where e.profile_id = p.id and e.created_at >= p.created_at + interval '1 day' and e.created_at < p.created_at + interval '2 days'))::int as day_1,
      count(*) filter (where exists (select 1 from public.events e where e.profile_id = p.id and e.created_at >= p.created_at + interval '7 days' and e.created_at < p.created_at + interval '8 days'))::int as day_7,
      count(*) filter (where exists (select 1 from public.events e where e.profile_id = p.id and e.created_at >= p.created_at + interval '30 days' and e.created_at < p.created_at + interval '31 days'))::int as day_30
    from profile_window p
  ),
  demographic(field, values) as (
    values
      ('institution', (select coalesce(jsonb_object_agg(coalesce(institution_name, 'Unknown'), n), '{}'::jsonb) from (select institution_name, count(*)::int n from profile_window group by institution_name) x)),
      ('discipline', (select coalesce(jsonb_object_agg(coalesce(discipline, 'Unknown'), n), '{}'::jsonb) from (select discipline, count(*)::int n from profile_window group by discipline) x)),
      ('level', (select coalesce(jsonb_object_agg(coalesce(year_of_study::text, 'Unknown'), n), '{}'::jsonb) from (select year_of_study, count(*)::int n from profile_window group by year_of_study) x)),
      ('state', (select coalesce(jsonb_object_agg(coalesce(state_of_origin, 'Unknown'), n), '{}'::jsonb) from (select state_of_origin, count(*)::int n from profile_window group by state_of_origin) x)),
      ('gender', (select coalesce(jsonb_object_agg(coalesce(gender, 'Unknown'), n), '{}'::jsonb) from (select gender, count(*)::int n from profile_window group by gender) x))
  ),
  acquisition as (
    select coalesce(nullif(trim(coalesce(utm_source, referral_source)), ''), 'Organic / unknown') as source,
      coalesce(nullif(trim(utm_medium), ''), '—') as medium,
      coalesce(nullif(trim(coalesce(utm_campaign, campaign_id)), ''), '—') as campaign,
      count(*)::int as signups,
      count(*) filter (where profile_completeness = 100)::int as completed_profiles,
      count(*) filter (where exists (select 1 from public.events e where e.profile_id = profile_window.id and e.event = 'match_viewed' and e.created_at between profile_window.created_at and profile_window.created_at + interval '7 days'))::int as activated,
      (select count(*)::int from public.applications a where a.profile_id = profile_window.id and a.created_at >= p_since and a.created_at < p_until) as applications
    from profile_window group by 1,2,3 order by signups desc
  ),
  scholarship_funnel as (
    select s.id, s.title, s.provider_name,
      (select count(distinct e.profile_id)::int from public.events e where e.event = 'match_viewed' and e.created_at >= p_since and e.created_at < p_until and (p_scholarship_id is null or s.id = p_scholarship_id) and e.meta->>'scholarship_id' = s.id::text) as views,
      (select count(distinct e.profile_id)::int from public.events e where e.event = 'match_viewed' and e.created_at >= p_since and e.created_at < p_until and (p_scholarship_id is null or s.id = p_scholarship_id) and e.meta->>'scholarship_id' = s.id::text and coalesce((e.meta->>'eligible')::boolean, false)) as eligible_students,
      (select count(*)::int from public.saved_scholarships x where x.scholarship_id = s.id and x.saved_at >= p_since and x.saved_at < p_until) as saves,
      (select count(*)::int from public.applications x where x.scholarship_id = s.id and x.created_at >= p_since and x.created_at < p_until) as application_starts,
      (select count(distinct e.profile_id)::int from public.events e join public.applications a on a.id = nullif(e.meta->>'application_id', '')::uuid where e.event = 'provider_clicked' and a.scholarship_id = s.id and e.created_at >= p_since and e.created_at < p_until) as provider_clicks,
      (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status::text, count(*)::int n from public.applications x where x.scholarship_id = s.id and x.updated_at >= p_since and x.updated_at < p_until group by status) outcomes) as outcomes
    from public.scholarships s
    where (p_scholarship_id is null or s.id = p_scholarship_id)
    order by views desc, saves desc, s.title
    limit 200
  )
  select jsonb_build_object(
    'window', jsonb_build_object('since', p_since, 'until', p_until),
    'growth', jsonb_build_object(
      'total_registered', (select count(*)::int from public.profiles),
      'daily_signups', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'signups', signups)) from daily_signups), '[]'::jsonb),
      'wau', (select count(distinct profile_id)::int from public.events where created_at >= p_until - interval '7 days' and created_at < p_until),
      'mau', (select count(distinct profile_id)::int from public.events where created_at >= p_until - interval '30 days' and created_at < p_until),
      'returning_users', (select count(*)::int from active_days where days_active >= 2)
    ),
    'activation', (select row_to_json(activation)::jsonb from activation),
    'retention', (select row_to_json(retention)::jsonb from retention),
    'demographics', coalesce((select jsonb_object_agg(field, values) from demographic), '{}'::jsonb),
    'acquisition', coalesce((select jsonb_agg(to_jsonb(acquisition)) from acquisition), '[]'::jsonb),
    'scholarship_funnel', coalesce((select jsonb_agg(to_jsonb(scholarship_funnel)) from scholarship_funnel), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_provider_analytics(timestamptz, timestamptz, uuid) from public;
grant execute on function public.get_provider_analytics(timestamptz, timestamptz, uuid) to authenticated;
