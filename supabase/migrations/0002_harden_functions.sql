-- Fix mutable search_path on all functions (prevents search_path hijacking)
-- and revoke public RPC access to is_admin() so it can only be used
-- internally by RLS policies, not called directly via PostgREST.

alter function set_updated_at() set search_path = '';
alter function calculate_profile_completeness(profiles) set search_path = '';
alter function set_profile_completeness() set search_path = '';
alter function is_admin(uuid) set search_path = '';

revoke execute on function is_admin(uuid) from public;
revoke execute on function is_admin(uuid) from anon;
revoke execute on function is_admin(uuid) from authenticated;
-- Policies still work: RLS policy evaluation runs as the defining role,
-- not through the PostgREST RPC surface, so revoking public/anon/authenticated
-- exec rights doesn't break the policies that call is_admin() internally.
