-- Security boundary remediation approved after Resource Center Phase 0.2.
-- This migration is intentionally explicit about anon/authenticated grants.
-- It does not change table data, RLS policies, or application behavior.

-- The repository migrations intended these worker RPCs to be service-role-only.
-- Revoking PUBLIC alone is insufficient when anon/authenticated have explicit
-- grants inherited from the live default-privilege configuration.
revoke all on function public.claim_notification_delivery(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(uuid, timestamptz)
  to service_role;

revoke all on function public.claim_workflow_job(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_workflow_job(text, timestamptz)
  to service_role;

revoke all on function public.complete_workflow_job(uuid, boolean, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_workflow_job(uuid, boolean, jsonb, jsonb, timestamptz)
  to service_role;

-- These are server-maintenance operations; no browser RPC caller was found.
revoke all on function public.flag_expired_opportunities()
  from public, anon, authenticated;
grant execute on function public.flag_expired_opportunities()
  to service_role;

revoke all on function public.seed_scholarship_prompts()
  from public, anon, authenticated;
grant execute on function public.seed_scholarship_prompts()
  to service_role;

-- Prevent future public-schema functions/tables from silently receiving broad
-- browser-role defaults. Existing objects retain their current ACLs and are
-- remediated explicitly in separate, reviewed changes.
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
