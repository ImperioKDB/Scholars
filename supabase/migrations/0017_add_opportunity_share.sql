-- Opportunity share XP: mirrors the scholarship share_click award for the
-- four opportunity kinds (fellowship, internship, competition, mentorship).
--
-- Same posture as share_click (app/api/xp/share/route.ts): deliberately
-- small points (3, hardcoded server-side, never accepted from the request
-- body), dedupe key 'opportunity_share:<opportunity_id>:<YYYY-MM-DD>' so
-- re-sharing the same opportunity the same day earns nothing, plus a hard
-- per-profile daily cap checked in the route before awarding.
--
-- The new enum value is REQUIRED before the route's
-- award_xp(p_event_type := 'opportunity_share') call can succeed. The
-- 'first_opportunity_share' achievement is checked by the same
-- run_achievement_checks() path that fires on every xp_events insert
-- (migration 0008), so it unlocks automatically once the row below exists.
--
-- NOT YET APPLIED. Run in the Supabase SQL editor (or MCP execute_sql),
-- then this file becomes the reference record -- do not re-run
-- ('if not exists' / 'on conflict do nothing' make re-runs harmless anyway).

alter type xp_event_type add value if not exists 'opportunity_share';

insert into achievements (id, label, description, xp_reward, tier)
values (
  'first_opportunity_share',
  'First Opportunity Share',
  'Shared a fellowship, internship, competition, or mentorship with a friend.',
  5,
  'bronze'
)
on conflict (id) do nothing;
