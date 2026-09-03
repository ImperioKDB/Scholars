-- Fix: `first_save` and `first_application` achievements could sit
-- unrecognized indefinitely. check_achievements() only ever ran on
-- xp_events INSERT, but saving a scholarship (saved_scholarships insert)
-- and starting an application (applications insert, default status
-- 'in_progress') never inserted an xp_events row themselves -- only
-- application SUBMISSION does, via the existing on_application_submitted
-- trigger. So those two achievements' conditions were correct in the
-- database the moment the action happened, but nothing re-ran
-- check_achievements() to notice until some unrelated xp_event fired
-- later (a share click, a referral, an application submission) --
-- meaning the unlock, the XP reward, and Ade's celebration prompt could
-- all be delayed by an arbitrary, unbounded amount of time, or in an
-- inactive student's case, never surface at all.
--
-- Fix: extract the actual check/unlock logic out of check_achievements()
-- into a reusable run_achievement_checks(profile_id) function, keep
-- check_achievements() as a thin wrapper on xp_events (unchanged
-- behavior, unchanged cost), and add two new lightweight AFTER INSERT
-- triggers -- one on saved_scholarships, one on applications -- that call
-- the same shared function the moment the actual triggering action
-- happens. Both are low-frequency events (a handful of saves/applications
-- per student, not spammy like share_click), so running the full
-- multi-condition check there is cheap and correct.
--
-- No changes to unlock semantics, XP amounts, or dedupe behavior -- this
-- is purely a "when does the check run" fix, not a "what does it check"
-- fix. Verified no trigger-name collision with the existing
-- on_application_submitted trigger (different name, different function,
-- both fire on applications INSERT harmlessly alongside each other).
--
-- APPLIED LIVE via Supabase MCP. This file is a reference record only,
-- per project convention -- do not re-run against the live project.

create or replace function public.run_achievement_checks(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_referral_count integer;
  v_completeness integer;
  v_has_saved boolean;
  v_has_application boolean;
  v_has_submission boolean;
begin
  select count(*) into v_referral_count
  from public.xp_events
  where profile_id = p_profile_id and event_type = 'referral_confirmed';

  select profile_completeness into v_completeness
  from public.profiles where id = p_profile_id;

  select exists(select 1 from public.saved_scholarships where profile_id = p_profile_id) into v_has_saved;
  select exists(select 1 from public.applications where profile_id = p_profile_id) into v_has_application;
  select exists(select 1 from public.applications where profile_id = p_profile_id and status = 'submitted') into v_has_submission;

  if v_completeness >= 100 then
    insert into public.user_achievements (profile_id, achievement_id) values (p_profile_id, 'profile_complete') on conflict do nothing;
  end if;
  if v_has_saved then
    insert into public.user_achievements (profile_id, achievement_id) values (p_profile_id, 'first_save') on conflict do nothing;
  end if;
  if v_has_application then
    insert into public.user_achievements (profile_id, achievement_id) values (p_profile_id, 'first_application') on conflict do nothing;
  end if;
  if v_has_submission then
    insert into public.user_achievements (profile_id, achievement_id) values (p_profile_id, 'first_submission') on conflict do nothing;
  end if;
  if v_referral_count >= 1 then
    insert into public.user_achievements (profile_id, achievement_id) values (p_profile_id, 'scout') on conflict do nothing;
  end if;
  if v_referral_count >= 5 then
    insert into public.user_achievements (profile_id, achievement_id) values (p_profile_id, 'connector') on conflict do nothing;
  end if;
  if v_referral_count >= 15 then
    insert into public.user_achievements (profile_id, achievement_id) values (p_profile_id, 'mentor') on conflict do nothing;
  end if;

  insert into public.xp_events (profile_id, event_type, points, dedupe_key)
  select ua.profile_id, 'achievement_unlock', a.xp_reward, 'achievement:' || a.id
  from public.user_achievements ua
  join public.achievements a on a.id = ua.achievement_id
  where ua.profile_id = p_profile_id
  on conflict (profile_id, dedupe_key) do nothing;
end;
$function$;

create or replace function public.check_achievements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.event_type = 'achievement_unlock' then
    return new;
  end if;

  perform public.run_achievement_checks(new.profile_id);
  return new;
end;
$function$;

create or replace function public.check_first_action_achievements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.run_achievement_checks(new.profile_id);
  return new;
end;
$function$;

drop trigger if exists on_saved_scholarship_insert on public.saved_scholarships;
create trigger on_saved_scholarship_insert
  after insert on public.saved_scholarships
  for each row execute function public.check_first_action_achievements();

drop trigger if exists on_application_insert_check_first on public.applications;
create trigger on_application_insert_check_first
  after insert on public.applications
  for each row execute function public.check_first_action_achievements();
