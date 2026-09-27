-- Community layer foundation.
-- Additive only: preserve existing discussions, reactions, moderation, and outbox tables.

DO $$ BEGIN
  CREATE TYPE public.community_role AS ENUM ('founder', 'contributor', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_role public.community_role NOT NULL DEFAULT 'student';

-- The live Scholars owner/admin is the founder account. This is deliberately
-- an idempotent seed, while all other profiles remain students until an admin
-- grants the contributor role through the protected admin route.
UPDATE public.profiles
SET community_role = 'founder'
WHERE id = '839d7530-28a6-44a9-bc8f-67e1eee02ad9'
  AND is_admin = true;

GRANT UPDATE (community_role) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS profiles_update_community_role_admin ON public.profiles;
CREATE POLICY profiles_update_community_role_admin
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.scholarship_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  prompt_text text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scholarship_prompts_prompt_key_length CHECK (char_length(btrim(prompt_key)) BETWEEN 2 AND 80),
  CONSTRAINT scholarship_prompts_prompt_text_length CHECK (char_length(btrim(prompt_text)) BETWEEN 10 AND 300),
  CONSTRAINT scholarship_prompts_sort_order_nonnegative CHECK (sort_order >= 0),
  CONSTRAINT scholarship_prompts_unique_key UNIQUE (scholarship_id, prompt_key)
);

CREATE INDEX IF NOT EXISTS idx_scholarship_prompts_scholarship_order
  ON public.scholarship_prompts (scholarship_id, sort_order, created_at);

ALTER TABLE public.scholarship_prompts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.scholarship_prompts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.scholarship_prompts TO authenticated;

DROP POLICY IF EXISTS scholarship_prompts_public_read ON public.scholarship_prompts;
CREATE POLICY scholarship_prompts_public_read
  ON public.scholarship_prompts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scholarships s
      WHERE s.id = scholarship_prompts.scholarship_id
        AND s.verified = true
    )
  );

DROP POLICY IF EXISTS scholarship_prompts_admin_write ON public.scholarship_prompts;
CREATE POLICY scholarship_prompts_admin_write
  ON public.scholarship_prompts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_scholarship_prompt_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scholarship_prompts_touch_updated_at ON public.scholarship_prompts;
CREATE TRIGGER scholarship_prompts_touch_updated_at
  BEFORE UPDATE ON public.scholarship_prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_scholarship_prompt_updated_at();

-- Prompts are editorial scaffolding, not fake member content. The trigger
-- creates exactly three neutral prompts whenever a listing becomes public.
CREATE OR REPLACE FUNCTION public.seed_scholarship_prompts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.verified IS DISTINCT FROM TRUE) THEN
    INSERT INTO public.scholarship_prompts (scholarship_id, prompt_key, prompt_text, sort_order)
    VALUES
      (
        NEW.id,
        'eligibility-check',
        format('What should applicants double-check before applying to %s?', NEW.title),
        1
      ),
      (
        NEW.id,
        'application-experience',
        'What was your general application experience like? Please keep personal documents and private details out of your reply.',
        2
      ),
      (
        NEW.id,
        'next-student-tip',
        'What practical tip would you share with the next student exploring this opportunity?',
        3
      )
    ON CONFLICT (scholarship_id, prompt_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scholarships_seed_community_prompts ON public.scholarships;
CREATE TRIGGER scholarships_seed_community_prompts
  AFTER INSERT OR UPDATE OF verified ON public.scholarships
  FOR EACH ROW EXECUTE FUNCTION public.seed_scholarship_prompts();

-- Backfill prompts for existing verified listings. No comments, users, or
-- reactions are created by this backfill.
INSERT INTO public.scholarship_prompts (scholarship_id, prompt_key, prompt_text, sort_order)
SELECT s.id, seed.prompt_key, seed.prompt_text, seed.sort_order
FROM public.scholarships s
CROSS JOIN LATERAL (
  VALUES
    ('eligibility-check', format('What should applicants double-check before applying to %s?', s.title), 1::smallint),
    ('application-experience', 'What was your general application experience like? Please keep personal documents and private details out of your reply.', 2::smallint),
    ('next-student-tip', 'What practical tip would you share with the next student exploring this opportunity?', 3::smallint)
) AS seed(prompt_key, prompt_text, sort_order)
WHERE s.verified = true
ON CONFLICT (scholarship_id, prompt_key) DO NOTHING;

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'discussion_reply';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'discussion_helpful';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS discussion_id uuid REFERENCES public.scholarship_discussions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_profile_read_created
  ON public.notifications (profile_id, read_at, created_at DESC);

GRANT UPDATE (read_at) ON public.notifications TO authenticated;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE OR REPLACE FUNCTION public.notify_discussion_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_author uuid;
  target_scholarship uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT author_id, scholarship_id
    INTO target_author, target_scholarship
  FROM public.scholarship_discussions
  WHERE id = NEW.parent_id;

  IF target_author IS NOT NULL AND target_author <> NEW.author_id THEN
    INSERT INTO public.notifications (
      profile_id,
      scholarship_id,
      type,
      discussion_id,
      actor_profile_id,
      metadata
    ) VALUES (
      target_author,
      target_scholarship,
      'discussion_reply'::public.notification_type,
      NEW.id,
      NEW.author_id,
      jsonb_build_object('parent_id', NEW.parent_id, 'anonymous', NEW.is_anonymous)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scholarship_discussions_notify_reply ON public.scholarship_discussions;
CREATE TRIGGER scholarship_discussions_notify_reply
  AFTER INSERT ON public.scholarship_discussions
  FOR EACH ROW EXECUTE FUNCTION public.notify_discussion_reply();

CREATE OR REPLACE FUNCTION public.notify_discussion_helpful()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_author uuid;
  target_scholarship uuid;
BEGIN
  SELECT author_id, scholarship_id
    INTO target_author, target_scholarship
  FROM public.scholarship_discussions
  WHERE id = NEW.discussion_id;

  IF target_author IS NOT NULL AND target_author <> NEW.profile_id THEN
    INSERT INTO public.notifications (
      profile_id,
      scholarship_id,
      type,
      discussion_id,
      actor_profile_id,
      metadata
    ) VALUES (
      target_author,
      target_scholarship,
      'discussion_helpful'::public.notification_type,
      NEW.discussion_id,
      NEW.profile_id,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scholarship_discussion_reactions_notify_helpful ON public.scholarship_discussion_reactions;
CREATE TRIGGER scholarship_discussion_reactions_notify_helpful
  AFTER INSERT ON public.scholarship_discussion_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_discussion_helpful();

-- Helpful reactions are only meaningful on visible community posts. The
-- existing owner-only reaction model is retained and strengthened here.
DROP POLICY IF EXISTS scholarship_discussion_reactions_insert_own ON public.scholarship_discussion_reactions;
CREATE POLICY scholarship_discussion_reactions_insert_own
  ON public.scholarship_discussion_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = profile_id
    AND EXISTS (
      SELECT 1
      FROM public.scholarship_discussions d
      JOIN public.scholarships s ON s.id = d.scholarship_id
      WHERE d.id = scholarship_discussion_reactions.discussion_id
        AND d.status = 'published'
        AND s.verified = true
    )
  );

-- The enriched RPC keeps the old author_label field and adds privacy-aware
-- profile presentation data for avatars, roles, and presence indicators.
DROP FUNCTION IF EXISTS public.get_scholarship_discussions(uuid, text, integer);
CREATE FUNCTION public.get_scholarship_discussions(
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
  author_name text,
  author_avatar_url text,
  author_role text,
  author_is_online boolean,
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
        WHEN d.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(NULLIF(btrim(p.full_name), ''), 'Student')
      END AS author_label,
      CASE
        WHEN d.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(NULLIF(btrim(p.full_name), ''), 'Student')
      END AS author_name,
      CASE WHEN d.is_anonymous THEN NULL ELSE p.avatar_url END AS author_avatar_url,
      CASE WHEN d.is_anonymous THEN NULL ELSE COALESCE(p.community_role::text, 'student') END AS author_role,
      CASE
        WHEN d.is_anonymous THEN false
        ELSE COALESCE(p.last_seen_at >= now() - interval '10 minutes', false)
      END AS author_is_online,
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
    v.author_name,
    v.author_avatar_url,
    v.author_role,
    v.author_is_online,
    v.user_helpful
  FROM visible v
  ORDER BY
    v.is_pinned DESC,
    CASE WHEN p_sort = 'recent' THEN v.created_at END DESC NULLS LAST,
    CASE WHEN p_sort <> 'recent' THEN v.helpful_count END DESC NULLS LAST,
    v.created_at DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 50), 100));
$$;
GRANT EXECUTE ON FUNCTION public.get_scholarship_discussions(uuid, text, integer) TO anon, authenticated;

-- Keep the analytics whitelist and admin summary aligned with the new
-- community events emitted by the existing events intake.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_whitelist;
ALTER TABLE public.events ADD CONSTRAINT events_event_whitelist CHECK (
  event IN (
    'profile_created','profile_completed','page_viewed','web_vital','client_error',
    'button_clicked','weekly_focus_viewed','weekly_focus_actioned',
    'onboarding_step_completed','onboarding_abandoned','onboarding_step_viewed',
    'provisional_matches_viewed','match_viewed','scholarship_saved',
    'scholarship_issue_reported','application_started','provider_clicked',
    'application_status_changed','draft_generated','draft_confirmed','gap_nudge_clicked',
    'outcome_recorded','whatsapp_opt_in','whatsapp_opt_out',
    'community_post_created','community_reply_created','community_helpful_reaction','community_reported'
  )
);

CREATE INDEX IF NOT EXISTS idx_events_community_created
  ON public.events (event, created_at DESC)
  WHERE event IN ('community_post_created','community_reply_created','community_helpful_reaction','community_reported');

CREATE OR REPLACE FUNCTION public.get_admin_metrics_summary(p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vital_rollup AS (
    SELECT
      meta ->> 'name' AS name,
      sum((meta ->> 'value')::numeric) AS total,
      count(*)::integer AS sample_count
    FROM public.events
    WHERE created_at >= p_since
      AND event = 'web_vital'
      AND coalesce(meta ->> 'value', '') ~ '^[0-9]+(\\.[0-9]+)?$'
    GROUP BY meta ->> 'name'
  ),
  outcome_rollup AS (
    SELECT status::text AS status, count(*)::integer AS count
    FROM public.applications
    GROUP BY status
  )
  SELECT jsonb_build_object(
    'activation', jsonb_build_object(
      'profile_created', count(*) FILTER (WHERE event = 'profile_created'),
      'provisional_matches_viewed', count(*) FILTER (WHERE event = 'provisional_matches_viewed'),
      'gap_nudge_clicked', count(*) FILTER (WHERE event = 'gap_nudge_clicked'),
      'profile_completed', count(*) FILTER (WHERE event = 'profile_completed'),
      'whatsapp_opt_in', count(*) FILTER (WHERE event = 'whatsapp_opt_in'),
      'onboarding_step_completed', count(*) FILTER (WHERE event = 'onboarding_step_completed'),
      'onboarding_abandoned', count(*) FILTER (WHERE event = 'onboarding_abandoned'),
      'button_clicked', count(*) FILTER (WHERE event = 'button_clicked'),
      'scholarship_issue_reported', count(*) FILTER (WHERE event = 'scholarship_issue_reported')
    ),
    'community', jsonb_build_object(
      'posts', count(*) FILTER (WHERE event = 'community_post_created'),
      'replies', count(*) FILTER (WHERE event = 'community_reply_created'),
      'helpful_reactions', count(*) FILTER (WHERE event = 'community_helpful_reaction'),
      'reports', count(*) FILTER (WHERE event = 'community_reported')
    ),
    'monitoring', jsonb_build_object(
      'pageViews', count(*) FILTER (WHERE event = 'page_viewed'),
      'clientErrors', count(*) FILTER (WHERE event = 'client_error'),
      'vitals', coalesce(
        (SELECT jsonb_object_agg(name, jsonb_build_object('total', total, 'count', sample_count)) FROM vital_rollup),
        '{}'::jsonb
      )
    ),
    'outcome', coalesce((SELECT jsonb_object_agg(status, count) FROM outcome_rollup), '{}'::jsonb)
  )
  FROM public.events
  WHERE created_at >= p_since
    AND public.is_admin(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_admin_metrics_summary(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.get_admin_metrics_summary(timestamptz) TO authenticated;
