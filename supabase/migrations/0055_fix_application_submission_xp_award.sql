-- Fix application status regression.
-- The application_submitted trigger calls award_xp(..., 'application_submitted', 25, ...).
-- Migration 0025 narrowed award_xp to share events only, so the trigger raised
-- "invalid share award" and PostgreSQL rolled back the entire status update.
-- Keep the authoritative daily share cap, while restoring the existing,
-- deduplicated 25 XP award for a first transition to Submitted.

CREATE OR REPLACE FUNCTION public.award_xp(
  p_profile_id uuid,
  p_event_type text,
  p_points integer,
  p_dedupe_key text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted boolean := false;
  today text := to_char(current_date, 'YYYY-MM-DD');
  today_count integer;
BEGIN
  IF p_event_type IN ('share_click', 'opportunity_share') THEN
    IF p_points <> 3 THEN
      RAISE EXCEPTION 'invalid share award';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_profile_id::text || ':' || today, 0)
    );

    SELECT count(*)::integer
      INTO today_count
      FROM public.xp_events
     WHERE profile_id = p_profile_id
       AND event_type IN ('share_click', 'opportunity_share')
       AND dedupe_key LIKE '%:' || today;

    IF today_count >= 10 THEN
      RETURN false;
    END IF;
  ELSIF p_event_type = 'application_submitted' THEN
    IF p_points <> 25 THEN
      RAISE EXCEPTION 'invalid application submission award';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid XP award';
  END IF;

  INSERT INTO public.xp_events (profile_id, event_type, points, dedupe_key, metadata)
  VALUES (p_profile_id, p_event_type, p_points, p_dedupe_key, p_metadata)
  ON CONFLICT (profile_id, dedupe_key) DO NOTHING
  RETURNING true INTO inserted;

  RETURN coalesce(inserted, false);
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(uuid, text, integer, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, text, integer, text, jsonb)
  TO service_role;
