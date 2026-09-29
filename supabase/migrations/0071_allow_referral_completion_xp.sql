-- Profile saves can cross the referral-completion threshold. The live
-- check_referral_completion() trigger calls award_xp(..., 'referral_confirmed',
-- 50, ...), but award_xp previously rejected every event except share and
-- application events with P0001, rolling back the profile upsert.
-- Keep the award server-side and deduplicated, while accepting the event the
-- existing trigger already uses.
create or replace function public.award_xp(
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
as $function$
declare
  inserted boolean := false;
  today text := to_char(current_date, 'YYYY-MM-DD');
  today_count integer;
begin
  if p_event_type in ('share_click', 'opportunity_share') then
    if p_points <> 3 then raise exception 'invalid share award'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || today, 0));
    select count(*)::integer into today_count
      from public.xp_events
     where profile_id = p_profile_id
       and event_type in ('share_click', 'opportunity_share')
       and dedupe_key like '%:' || today;
    if today_count >= 10 then return false; end if;
  elsif p_event_type = 'application_submitted' then
    if p_points <> 25 then raise exception 'invalid application submission award'; end if;
  elsif p_event_type = 'referral_confirmed' then
    if p_points <> 50 then raise exception 'invalid referral award'; end if;
  else
    raise exception 'invalid XP award';
  end if;

  insert into public.xp_events (profile_id, event_type, points, dedupe_key, metadata)
  values (p_profile_id, p_event_type, p_points, p_dedupe_key, p_metadata)
  on conflict (profile_id, dedupe_key) do nothing
  returning true into inserted;

  return coalesce(inserted, false);
end;
$function$;

revoke all on function public.award_xp(uuid, text, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.award_xp(uuid, text, integer, text, jsonb)
  to service_role;
