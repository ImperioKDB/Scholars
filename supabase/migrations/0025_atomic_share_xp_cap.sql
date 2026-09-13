-- Make share XP caps authoritative in the database.
-- The route's preflight count remains a UX optimization; this function is the
-- security boundary and serializes awards per profile/day.
drop function if exists public.award_xp(uuid, text, integer, text, jsonb);

create function public.award_xp(
  p_profile_id uuid,
  p_event_type text,
  p_points integer,
  p_dedupe_key text,
  p_metadata jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted boolean := false;
  today text := to_char(current_date, 'YYYY-MM-DD');
  today_count integer;
begin
  if p_event_type not in ('share_click', 'opportunity_share') or p_points <> 3 then
    raise exception 'invalid share award';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || today, 0));

  select count(*)::integer into today_count
  from public.xp_events
  where profile_id = p_profile_id
    and event_type in ('share_click', 'opportunity_share')
    and dedupe_key like '%:' || today;

  if today_count >= 10 then
    return false;
  end if;

  insert into public.xp_events (profile_id, event_type, points, dedupe_key, metadata)
  values (p_profile_id, p_event_type, p_points, p_dedupe_key, p_metadata)
  on conflict (profile_id, dedupe_key) do nothing
  returning true into inserted;

  return coalesce(inserted, false);
end;
$$;

revoke all on function public.award_xp(uuid, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, text, integer, text, jsonb) to service_role;
