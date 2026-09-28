-- Optional public bio for community contributors.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_bio text
  CHECK (community_bio IS NULL OR char_length(community_bio) <= 280);

GRANT UPDATE (community_bio) ON TABLE public.profiles TO authenticated;

-- Public contributor lookup is intentionally scoped to a published, verified,
-- non-anonymous discussion. It never returns email, private profile fields, or
-- a profile for an anonymous contribution.
CREATE OR REPLACE FUNCTION public.get_community_contributor_profile(p_discussion_id uuid)
RETURNS TABLE (
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
  JOIN public.scholarships s
    ON s.id = d.scholarship_id
  JOIN public.profiles p
    ON p.id = d.author_id
  WHERE d.id = p_discussion_id
    AND d.status = 'published'
    AND d.is_anonymous = false
    AND s.verified = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_community_contributor_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_contributor_profile(uuid) TO anon, authenticated;
