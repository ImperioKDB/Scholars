-- Scholarship discussions + social proof
-- Additive only: no existing tables, buckets, rows, or data are deleted.

DO $$ BEGIN
  CREATE TYPE public.discussion_category AS ENUM ('question', 'answer', 'experience', 'update');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.discussion_status AS ENUM ('published', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.discussion_report_reason AS ENUM ('misleading', 'abusive', 'outdated', 'personal_information', 'spam');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.discussion_report_status AS ENUM ('open', 'reviewed', 'dismissed', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.scholarship_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.scholarship_discussions(id) ON DELETE CASCADE,
  category public.discussion_category NOT NULL,
  title text,
  body text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT true,
  status public.discussion_status NOT NULL DEFAULT 'published',
  is_pinned boolean NOT NULL DEFAULT false,
  is_verified_contributor boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scholarship_discussions_title_length CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 5 AND 140),
  CONSTRAINT scholarship_discussions_body_length CHECK (char_length(btrim(body)) BETWEEN 10 AND 2000),
  CONSTRAINT scholarship_discussions_helpful_count_nonnegative CHECK (helpful_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.scholarship_discussion_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.scholarship_discussions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scholarship_discussion_reactions_unique UNIQUE (discussion_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.scholarship_discussion_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.scholarship_discussions(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason public.discussion_report_reason NOT NULL,
  details text,
  status public.discussion_report_status NOT NULL DEFAULT 'open',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scholarship_discussion_reports_details_length CHECK (details IS NULL OR char_length(details) <= 500),
  CONSTRAINT scholarship_discussion_reports_unique UNIQUE (discussion_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_scholarship_discussions_scholarship_status_created
  ON public.scholarship_discussions (scholarship_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scholarship_discussions_parent
  ON public.scholarship_discussions (parent_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scholarship_discussion_reports_open
  ON public.scholarship_discussion_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_match_viewed_scholarship
  ON public.events ((meta->>'scholarship_id'), created_at DESC)
  WHERE event = 'match_viewed';

CREATE OR REPLACE FUNCTION public.touch_scholarship_discussion_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scholarship_discussions_touch_updated_at ON public.scholarship_discussions;
CREATE TRIGGER scholarship_discussions_touch_updated_at
  BEFORE UPDATE ON public.scholarship_discussions
  FOR EACH ROW EXECUTE FUNCTION public.touch_scholarship_discussion_updated_at();

CREATE OR REPLACE FUNCTION public.validate_scholarship_discussion_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_scholarship_id uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT scholarship_id INTO parent_scholarship_id
  FROM public.scholarship_discussions
  WHERE id = NEW.parent_id;

  IF parent_scholarship_id IS NULL OR parent_scholarship_id <> NEW.scholarship_id THEN
    RAISE EXCEPTION 'Discussion replies must stay on the same scholarship';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scholarship_discussions_validate_parent ON public.scholarship_discussions;
CREATE TRIGGER scholarship_discussions_validate_parent
  BEFORE INSERT OR UPDATE OF parent_id, scholarship_id ON public.scholarship_discussions
  FOR EACH ROW EXECUTE FUNCTION public.validate_scholarship_discussion_parent();

CREATE OR REPLACE FUNCTION public.sync_scholarship_discussion_helpful_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_discussion_id uuid;
BEGIN
  target_discussion_id := COALESCE(NEW.discussion_id, OLD.discussion_id);
  UPDATE public.scholarship_discussions
  SET helpful_count = (
    SELECT count(*)::integer
    FROM public.scholarship_discussion_reactions
    WHERE discussion_id = target_discussion_id
  )
  WHERE id = target_discussion_id;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scholarship_discussion_reactions_sync_count ON public.scholarship_discussion_reactions;
CREATE TRIGGER scholarship_discussion_reactions_sync_count
  AFTER INSERT OR DELETE ON public.scholarship_discussion_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_scholarship_discussion_helpful_count();

ALTER TABLE public.scholarship_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_discussion_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_discussion_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scholarship_discussions_public_read ON public.scholarship_discussions;
CREATE POLICY scholarship_discussions_public_read
  ON public.scholarship_discussions FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.scholarships s
      WHERE s.id = scholarship_discussions.scholarship_id
        AND s.verified = true
    )
  );

DROP POLICY IF EXISTS scholarship_discussions_insert_own ON public.scholarship_discussions;
CREATE POLICY scholarship_discussions_insert_own
  ON public.scholarship_discussions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.scholarships s
      WHERE s.id = scholarship_discussions.scholarship_id
        AND s.verified = true
    )
  );

DROP POLICY IF EXISTS scholarship_discussion_reactions_select_own ON public.scholarship_discussion_reactions;
CREATE POLICY scholarship_discussion_reactions_select_own
  ON public.scholarship_discussion_reactions FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS scholarship_discussion_reactions_insert_own ON public.scholarship_discussion_reactions;
CREATE POLICY scholarship_discussion_reactions_insert_own
  ON public.scholarship_discussion_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS scholarship_discussion_reactions_delete_own ON public.scholarship_discussion_reactions;
CREATE POLICY scholarship_discussion_reactions_delete_own
  ON public.scholarship_discussion_reactions FOR DELETE TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS scholarship_discussion_reports_insert_own ON public.scholarship_discussion_reports;
CREATE POLICY scholarship_discussion_reports_insert_own
  ON public.scholarship_discussion_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS scholarship_discussion_reports_select_own ON public.scholarship_discussion_reports;
CREATE POLICY scholarship_discussion_reports_select_own
  ON public.scholarship_discussion_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

GRANT SELECT ON public.scholarship_discussions TO anon, authenticated;
GRANT INSERT ON public.scholarship_discussions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.scholarship_discussion_reactions TO authenticated;
GRANT INSERT, SELECT ON public.scholarship_discussion_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.get_scholarship_discussions(
  p_scholarship_id uuid,
  p_sort text DEFAULT 'helpful',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  scholarship_id uuid,
  parent_id uuid,
  category text,
  title text,
  body text,
  is_anonymous boolean,
  is_pinned boolean,
  is_verified_contributor boolean,
  created_at timestamptz,
  updated_at timestamptz,
  helpful_count integer,
  reply_count integer,
  author_label text,
  user_helpful boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT
      d.id,
      d.scholarship_id,
      d.parent_id,
      d.category::text AS category,
      d.title,
      d.body,
      d.is_anonymous,
      d.is_pinned,
      d.is_verified_contributor,
      d.created_at,
      d.updated_at,
      d.helpful_count,
      CASE
        WHEN d.is_anonymous THEN 'Anonymous student'
        WHEN d.is_verified_contributor THEN 'Verified contributor'
        ELSE COALESCE(NULLIF(btrim(p.full_name), ''), 'Student contributor')
      END AS author_label,
      EXISTS (
        SELECT 1
        FROM public.scholarship_discussion_reactions r
        WHERE r.discussion_id = d.id
          AND r.profile_id = auth.uid()
      ) AS user_helpful
    FROM public.scholarship_discussions d
    LEFT JOIN public.profiles p ON p.id = d.author_id
    WHERE d.scholarship_id = p_scholarship_id
      AND d.status = 'published'
      AND EXISTS (
        SELECT 1 FROM public.scholarships s
        WHERE s.id = d.scholarship_id AND s.verified = true
      )
  )
  SELECT
    v.id,
    v.scholarship_id,
    v.parent_id,
    v.category,
    v.title,
    v.body,
    v.is_anonymous,
    v.is_pinned,
    v.is_verified_contributor,
    v.created_at,
    v.updated_at,
    v.helpful_count,
    (
      SELECT count(*)::integer
      FROM public.scholarship_discussions reply
      WHERE reply.parent_id = v.id AND reply.status = 'published'
    ) AS reply_count,
    v.author_label,
    v.user_helpful
  FROM visible v
  ORDER BY
    v.is_pinned DESC,
    CASE WHEN p_sort = 'recent' THEN v.created_at END DESC NULLS LAST,
    CASE WHEN p_sort <> 'recent' THEN v.helpful_count END DESC NULLS LAST,
    v.created_at DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 50), 100));
$$;

CREATE OR REPLACE FUNCTION public.get_scholarship_social_proof(p_scholarship_id uuid)
RETURNS TABLE (
  saved_count integer,
  applied_count integer,
  discussion_student_count integer,
  discussion_count integer,
  recent_view_count integer,
  recent_institutions jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH verified AS (
    SELECT 1
    FROM public.scholarships
    WHERE id = p_scholarship_id AND verified = true
  ),
  saved AS (
    SELECT count(DISTINCT profile_id)::integer AS count
    FROM public.saved_scholarships
    WHERE scholarship_id = p_scholarship_id
      AND EXISTS (SELECT 1 FROM verified)
  ),
  applied AS (
    SELECT count(DISTINCT profile_id)::integer AS count
    FROM public.applications
    WHERE scholarship_id = p_scholarship_id
      AND EXISTS (SELECT 1 FROM verified)
  ),
  discussions AS (
    SELECT
      count(*)::integer AS total,
      count(DISTINCT author_id)::integer AS students
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
      jsonb_agg(
        jsonb_build_object('name', institution_name, 'count', student_count)
        ORDER BY student_count DESC, institution_name ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        NULLIF(btrim(p.institution_name), '') AS institution_name,
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
    COALESCE((SELECT students FROM discussions), 0),
    COALESCE((SELECT total FROM discussions), 0),
    COALESCE((SELECT count FROM views), 0),
    (SELECT rows FROM institutions);
$$;

GRANT EXECUTE ON FUNCTION public.get_scholarship_discussions(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scholarship_social_proof(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_scholarship_social_proof(uuid) IS
  'Returns aggregate scholarship activity only. Institution names are emitted after a five-student privacy threshold.';
COMMENT ON TABLE public.scholarship_discussions IS
  'Moderated community questions, answers, experiences, and updates attached to verified scholarships.';
