-- Exact activity counts for the scholarship community summary.
-- No rows are created; only aggregate reads are expanded.
DROP FUNCTION IF EXISTS public.get_scholarship_social_proof(uuid);

CREATE FUNCTION public.get_scholarship_social_proof(p_scholarship_id uuid)
RETURNS TABLE (
  saved_count integer,
  applied_count integer,
  discussion_student_count integer,
  discussion_count integer,
  discussion_post_count integer,
  discussion_reply_count integer,
  discussion_contributor_count integer,
  recent_view_count integer,
  recent_institutions jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH verified AS (
    SELECT 1 FROM public.scholarships
    WHERE id = p_scholarship_id AND verified = true
  ),
  saved AS (
    SELECT count(DISTINCT profile_id)::integer AS count
    FROM public.saved_scholarships
    WHERE scholarship_id = p_scholarship_id AND EXISTS (SELECT 1 FROM verified)
  ),
  applied AS (
    SELECT count(DISTINCT profile_id)::integer AS count
    FROM public.applications
    WHERE scholarship_id = p_scholarship_id AND EXISTS (SELECT 1 FROM verified)
  ),
  discussions AS (
    SELECT
      count(*) FILTER (WHERE parent_id IS NULL)::integer AS posts,
      count(*) FILTER (WHERE parent_id IS NOT NULL)::integer AS replies,
      count(DISTINCT author_id)::integer AS contributors
    FROM public.scholarship_discussions
    WHERE scholarship_id = p_scholarship_id
      AND status = 'published'
      AND EXISTS (SELECT 1 FROM verified)
  ),
  views AS (
    SELECT count(DISTINCT e.profile_id)::integer AS count
    FROM public.events e
    WHERE e.event = 'match_viewed'
      AND e.meta->>'scholarship_id' = p_scholarship_id::text
      AND e.created_at >= now() - interval '30 days'
      AND EXISTS (SELECT 1 FROM verified)
  ),
  institutions AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', institution_name, 'count', student_count)
        ORDER BY student_count DESC, institution_name ASC), '[]'::jsonb
    ) AS rows
    FROM (
      SELECT NULLIF(btrim(p.institution_name), '') AS institution_name,
             count(DISTINCT e.profile_id)::integer AS student_count
      FROM public.events e
      JOIN public.profiles p ON p.id = e.profile_id
      WHERE e.event = 'match_viewed'
        AND e.meta->>'scholarship_id' = p_scholarship_id::text
        AND e.created_at >= now() - interval '30 days'
        AND NULLIF(btrim(p.institution_name), '') IS NOT NULL
        AND EXISTS (SELECT 1 FROM verified)
      GROUP BY NULLIF(btrim(p.institution_name), '')
      HAVING count(DISTINCT e.profile_id) >= 5
      ORDER BY student_count DESC, institution_name ASC
      LIMIT 3
    ) safe_institutions
  )
  SELECT
    COALESCE((SELECT count FROM saved), 0),
    COALESCE((SELECT count FROM applied), 0),
    COALESCE((SELECT contributors FROM discussions), 0),
    COALESCE((SELECT posts + replies FROM discussions), 0),
    COALESCE((SELECT posts FROM discussions), 0),
    COALESCE((SELECT replies FROM discussions), 0),
    COALESCE((SELECT contributors FROM discussions), 0),
    COALESCE((SELECT count FROM views), 0),
    (SELECT rows FROM institutions);
$$;

GRANT EXECUTE ON FUNCTION public.get_scholarship_social_proof(uuid) TO anon, authenticated;
