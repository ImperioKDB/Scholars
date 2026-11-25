-- Restrict direct API execution of achievement trigger helpers.
-- Applied to production through Supabase migration:
-- 20261125044414_restrict_achievement_trigger_rpc_execution
--
-- Trigger definitions remain intact. The functions are owned by
-- postgres and retain service_role execution privileges.

REVOKE EXECUTE ON FUNCTION public.run_achievement_checks(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.check_achievements()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.check_first_action_achievements()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.check_community_discussion_achievements()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.check_community_reaction_achievements()
FROM PUBLIC, anon, authenticated;
