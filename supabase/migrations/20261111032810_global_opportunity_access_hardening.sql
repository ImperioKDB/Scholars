-- Global opportunity access hardening (feature-branch migration; do not apply to production without review).
-- Public catalog traffic gets fixed-column, verified-only SECURITY INVOKER
-- views with security barriers, so caller RLS and column privileges apply.
-- Column-level anon grants expose only fixed safe fields; descriptions,
-- eligibility/application data, research notes, competitiveness details and
-- user-linked data are excluded.
--
-- The existing authenticated policies and explicit authenticated grants remain
-- in place. Public scholarship community discussion RPC/table access is removed
-- for anon only; authenticated community flows and the explicitly public,
-- privacy-filtered contributor-profile RPCs are retained.
--
-- ROLLBACK (security-degrading; do not run casually): DROP these two views;
-- restore former anon/PUBLIC SELECT grants on opportunities, scholarships,
-- scholarship_rules, scholarship_discussions, and scholarship_prompts; restore
-- the former public-read policies on opportunities, scholarships, discussions,
-- and prompts; and restore anon EXECUTE on the two discussion RPCs
-- below. This restores the broader exposure being closed here. Review the
-- previous grants/policies in migrations 0001, 0034 and 0056 before rollback;
-- prefer a reviewed forward migration over blind rollback.

BEGIN;

CREATE VIEW public.opportunities_public_preview_v1
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  id,
  slug,
  type,
  title,
  provider_name,
  duration,
  location,
  compensation,
  deadline,
  verified
FROM public.opportunities
WHERE verified IS TRUE;

CREATE VIEW public.scholarships_public_preview_v1
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  id,
  slug,
  title,
  provider_name,
  amount,
  deadline,
  opens_at,
  last_cycle_closed_at,
  level,
  discipline,
  verified,
  last_verified_at
FROM public.scholarships
WHERE verified IS TRUE;

REVOKE ALL PRIVILEGES ON TABLE public.opportunities_public_preview_v1,
  public.scholarships_public_preview_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.opportunities_public_preview_v1,
  public.scholarships_public_preview_v1 TO anon, authenticated;

-- These tables contain richer trusted/admin/user-submitted fields. Do not let
-- anon or PUBLIC query them directly. Explicit authenticated/service_role
-- privileges are not revoked by revoking grants from PUBLIC and anon.
REVOKE ALL PRIVILEGES ON TABLE public.opportunities, public.scholarships
  FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.opportunities, public.scholarships TO authenticated;
-- Remove historical column-level grants too: table-level REVOKE does not
-- remove separately granted column ACLs on restricted fields.
REVOKE SELECT (description, eligibility_notes, application_url, how_to_apply,
  research_notes, created_by, deadline_passed_at)
  ON TABLE public.opportunities FROM PUBLIC, anon;
REVOKE SELECT (description, application_url, how_to_apply, research_notes,
  awards_available, estimated_applicant_pool, competitiveness_tier,
  historical_acceptance_rate, competitiveness_notes, created_by)
  ON TABLE public.scholarships FROM PUBLIC, anon;
-- SECURITY INVOKER views require caller privileges on source columns. Keep
-- these anon grants narrower than table-level SELECT.
GRANT SELECT (id, slug, type, title, provider_name, duration, location,
  compensation, deadline, verified)
  ON TABLE public.opportunities TO anon;
GRANT SELECT (id, slug, title, provider_name, amount, deadline, opens_at,
  last_cycle_closed_at, level, discipline, verified, last_verified_at)
  ON TABLE public.scholarships TO anon;
-- Structured scholarship eligibility rules are a separate RLS-protected table;
-- keep the existing authenticated matching/checklist access, but make the
-- anonymous denial explicit at the table-privilege layer as well.
REVOKE ALL PRIVILEGES ON TABLE public.scholarship_rules FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.scholarship_rules TO authenticated;

-- Defense in depth for RLS and Realtime: anonymous requests must not receive
-- rows even if a future table grant is accidentally added.
DROP POLICY IF EXISTS opportunities_select_verified ON public.opportunities;
CREATE POLICY opportunities_select_verified
  ON public.opportunities FOR SELECT TO authenticated
  USING (verified IS TRUE);
DROP POLICY IF EXISTS opportunities_public_preview_verified ON public.opportunities;
CREATE POLICY opportunities_public_preview_verified
  ON public.opportunities FOR SELECT TO anon
  USING (verified IS TRUE);

DROP POLICY IF EXISTS scholarships_select_verified ON public.scholarships;
CREATE POLICY scholarships_select_verified
  ON public.scholarships FOR SELECT TO authenticated
  USING (
    verified IS TRUE
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.saved_scholarships AS ss
      WHERE ss.scholarship_id = scholarships.id
        AND ss.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.applications AS a
      WHERE a.scholarship_id = scholarships.id
        AND a.profile_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS scholarships_public_preview_verified ON public.scholarships;
CREATE POLICY scholarships_public_preview_verified
  ON public.scholarships FOR SELECT TO anon
  USING (verified IS TRUE);

-- Remove anonymous discussion/prompt reads. The signed-in community page and
-- server API continue using the same tables and authenticated RLS policies.
REVOKE ALL PRIVILEGES ON TABLE public.scholarship_discussions,
  public.scholarship_prompts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.scholarship_discussions,
  public.scholarship_prompts TO authenticated;

DROP POLICY IF EXISTS scholarship_discussions_public_read
  ON public.scholarship_discussions;
-- Production may already have this authenticated policy from a newer,
-- separately-applied migration. Preserve it rather than replacing unknown
-- live policy logic; add the reviewed fallback only when it is absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scholarship_discussions'
      AND policyname = 'scholarship_discussions_authenticated_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY scholarship_discussions_authenticated_read
        ON public.scholarship_discussions FOR SELECT TO authenticated
        USING (
          status = 'published'
          AND EXISTS (
            SELECT 1 FROM public.scholarships AS s
            WHERE s.id = scholarship_discussions.scholarship_id
              AND s.verified IS TRUE
          )
        )
    $policy$;
  END IF;
END;
$$;

DROP POLICY IF EXISTS scholarship_prompts_public_read
  ON public.scholarship_prompts;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scholarship_prompts'
      AND policyname = 'scholarship_prompts_authenticated_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY scholarship_prompts_authenticated_read
        ON public.scholarship_prompts FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.scholarships AS s
            WHERE s.id = scholarship_prompts.scholarship_id
              AND s.verified IS TRUE
          )
        )
    $policy$;
  END IF;
END;
$$;

-- These are the only public community-data RPCs found in the tracked migration
-- history; the app calls them only from authenticated community surfaces.
-- Revoke the default PUBLIC execution grant and anon, then preserve
-- authenticated execution. Deliberately leave public contributor-profile RPCs
-- untouched: their tracked definitions expose only non-anonymous contributions
-- and are used by the intended public contributor-profile feature.
REVOKE ALL ON FUNCTION public.get_scholarship_discussions(uuid, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scholarship_discussions(uuid, text, integer)
  TO authenticated;
REVOKE ALL ON FUNCTION public.get_scholarship_social_proof(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scholarship_social_proof(uuid)
  TO authenticated;

COMMIT;
