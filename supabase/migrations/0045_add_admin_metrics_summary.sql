-- Keep the admin overview fast as events and applications grow.
-- Aggregate monitoring, activation, and outcome metrics inside Postgres instead
-- of serializing every row into a server component on every admin visit.
create or replace function public.get_admin_metrics_summary(p_since timestamptz)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with vital_rollup as (
    select
      meta ->> 'name' as name,
      sum((meta ->> 'value')::numeric) as total,
      count(*)::integer as sample_count
    from public.events
    where created_at >= p_since
      and event = 'web_vital'
      and coalesce(meta ->> 'value', '') ~ '^[0-9]+(\.[0-9]+)?$'
    group by meta ->> 'name'
  ),
  outcome_rollup as (
    select status::text as status, count(*)::integer as count
    from public.applications
    group by status
  )
  select jsonb_build_object(
    'activation', jsonb_build_object(
      'profile_created', count(*) filter (where event = 'profile_created'),
      'provisional_matches_viewed', count(*) filter (where event = 'provisional_matches_viewed'),
      'gap_nudge_clicked', count(*) filter (where event = 'gap_nudge_clicked'),
      'profile_completed', count(*) filter (where event = 'profile_completed'),
      'whatsapp_opt_in', count(*) filter (where event = 'whatsapp_opt_in'),
      'onboarding_step_completed', count(*) filter (where event = 'onboarding_step_completed'),
      'onboarding_abandoned', count(*) filter (where event = 'onboarding_abandoned'),
      'button_clicked', count(*) filter (where event = 'button_clicked'),
      'scholarship_issue_reported', count(*) filter (where event = 'scholarship_issue_reported')
    ),
    'monitoring', jsonb_build_object(
      'pageViews', count(*) filter (where event = 'page_viewed'),
      'clientErrors', count(*) filter (where event = 'client_error'),
      'vitals', coalesce(
        (select jsonb_object_agg(
          name,
          jsonb_build_object('total', total, 'count', sample_count)
        ) from vital_rollup),
        '{}'::jsonb
      )
    ),
    'outcome', coalesce(
      (select jsonb_object_agg(status, count) from outcome_rollup),
      '{}'::jsonb
    )
  )
  from public.events
  where created_at >= p_since
    and public.is_admin(auth.uid());
$$;

revoke all on function public.get_admin_metrics_summary(timestamptz) from public;
grant execute on function public.get_admin_metrics_summary(timestamptz) to authenticated;

create index if not exists idx_applications_status on public.applications (status);
