-- ACHIEVEMENTS UPGRADE (#2) support: let a student read their OWN
-- xp_events rows so the achievements page can show real referral progress
-- ("2 of 5 referrals"). Previously xp_events had no read policy for the
-- authenticated role, so the page had to degrade referral counts to 0.
--
-- Safe: select-only, scoped to auth.uid() = profile_id. Writes still go
-- through triggers / the service role (award_xp), never the client.
-- Enabling RLS here is a no-op if already enabled; the select-own policy
-- is the only policy added, so no other access changes.
--
-- NOT YET APPLIED. Run in the Supabase SQL editor (or MCP execute_sql).
-- If you skip it, referral progress shows 0 and everything else works.
alter table public.xp_events enable row level security;
drop policy if exists "xp_events_select_own" on public.xp_events;
create policy "xp_events_select_own" on public.xp_events
for select using (auth.uid() = profile_id);
