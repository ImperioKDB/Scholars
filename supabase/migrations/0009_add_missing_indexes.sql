-- Indexes for foreign-key and hot lookup columns. Postgres does NOT
-- auto-index foreign keys; every column below is hit by a filtered query
-- or a PostgREST resource-embed join in the cited file, and without an
-- index each one is a sequential scan at MVP scale and worse beyond it.
--
-- NOT YET APPLIED. Apply live via the Supabase SQL editor (or MCP
-- execute_sql) using the steps in the phase-2 review note, per this
-- repo's convention that migration files are reference records and the
-- live schema is the source of truth. After applying, this file stays
-- the reference record -- do not re-run it (IF NOT EXISTS makes re-runs
-- harmless anyway).
--
-- Two of the single-column indexes below (applications.profile_id,
-- saved_scholarships.profile_id) overlap the leading column of the
-- unique (profile_id, scholarship_id) composites; they are kept because
-- the spec calls them out explicitly and the write-amplification cost at
-- this write volume is negligible.

-- Speeds the rules embed in app/api/admin/scholarships/route.ts
-- (select '*, scholarship_rules (...)') and the single-scholarship rules
-- fetch in lib/matching/getMatches.ts getMatchForScholarship().
create index if not exists idx_scholarship_rules_scholarship_id
  on public.scholarship_rules (scholarship_id);

-- Speeds GET /api/applications (app/api/applications/route.ts) and
-- app/applications/page.tsx: .eq('profile_id', user.id) on every load.
create index if not exists idx_applications_profile_id
  on public.applications (profile_id);

-- Speeds the cron phase-2 join and Ade's overdue query
-- (app/api/cron/deadline-check/route.ts, app/api/mascot/next-prompt/route.ts)
-- which join applications by scholarship_id.
create index if not exists idx_applications_scholarship_id
  on public.applications (scholarship_id);

-- Speeds GET /api/scholarships/save and the dashboard/discover saved
-- lists (app/dashboard/page.tsx, app/discover/page.tsx):
-- .eq('profile_id', user.id) on every load.
create index if not exists idx_saved_scholarships_profile_id
  on public.saved_scholarships (profile_id);

-- Speeds get_trending_scholarship_ids() (called from
-- app/dashboard/page.tsx) which groups saves by scholarship_id.
create index if not exists idx_saved_scholarships_scholarship_id
  on public.saved_scholarships (scholarship_id);

-- Composite matching the cron dedupe query exactly
-- (app/api/cron/deadline-check/route.ts): .eq('type', ...).in(
-- 'scholarship_id', ...) against notifications; column order follows the
-- equality-first, then membership, selectivity pattern.
create index if not exists idx_notifications_dedupe
  on public.notifications (profile_id, scholarship_id, type);

-- Speeds app/achievements/page.tsx and the achievement poll in
-- app/api/mascot/next-prompt/route.ts: .eq('profile_id', user.id).
create index if not exists idx_user_achievements_profile_id
  on public.user_achievements (profile_id);
