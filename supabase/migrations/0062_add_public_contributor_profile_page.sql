-- Stage 2: expose the same privacy-safe contributor fields through a stable
-- profile URL. Only contributors with at least one published, non-anonymous
-- contribution on a verified scholarship are addressable.
DROP FUNCTION IF EXISTS public.get_community_contributor_profile(uuid);

CREATE FUNCTION public.get_community_contributor_profile(p_discussion_id uuid)
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  institution_name text,
  bio text,
  community_role text,
  contribution_count bigint,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS profile_id,
    COALESCE(NULLIF(btrim(p.full_name), ''), 'Student') AS display_name,
    NULLIF(btrim(p.institution_name), '') AS institution_name,
    NULLIF(btrim(p.community_bio), '') AS bio,
    COALESCE(p.community_role::text, 'student') AS community_role,
    (
      SELECT count(*)
      FROM public.scholarship_discussions contributions
      JOIN public.scholarships contribution_scholarship
        ON contribution_scholarship.id = contributions.scholarship_id
      WHERE contributions.author_id = d.author_id
        AND contributions.status = 'published'
        AND contributions.is_anonymous = false
        AND contribution_scholarship.verified = true
    ) AS contribution_count,
    p.avatar_url
  FROM public.scholarship_discussions d
  JOIN public.scholarships s ON s.id = d.scholarship_id
  JOIN public.profiles p ON p.id = d.author_id
  WHERE d.id = p_discussion_id
    AND d.status = 'published'
    AND d.is_anonymous = false
    AND s.verified = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_contributor_profile(p_profile_id uuid)
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  institution_name text,
  bio text,
  community_role text,
  contribution_count bigint,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS profile_id,
    COALESCE(NULLIF(btrim(p.full_name), ''), 'Student') AS display_name,
    NULLIF(btrim(p.institution_name), '') AS institution_name,
    NULLIF(btrim(p.community_bio), '') AS bio,
    COALESCE(p.community_role::text, 'student') AS community_role,
    (
      SELECT count(*)
      FROM public.scholarship_discussions contributions
      JOIN public.scholarships contribution_scholarship
        ON contribution_scholarship.id = contributions.scholarship_id
      WHERE contributions.author_id = p.id
        AND contributions.status = 'published'
        AND contributions.is_anonymous = false
        AND contribution_scholarship.verified = true
    ) AS contribution_count,
    p.avatar_url
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND EXISTS (
      SELECT 1
      FROM public.scholarship_discussions d
      JOIN public.scholarships s ON s.id = d.scholarship_id
      WHERE d.author_id = p.id
        AND d.status = 'published'
        AND d.is_anonymous = false
        AND s.verified = true
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_community_contributor_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_contributor_profile(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_contributor_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contributor_profile(uuid) TO anon, authenticated;
