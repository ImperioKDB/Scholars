-- Flag verified opportunities after their deadline and notify every admin once.
-- The Vercel cron route calls flag_expired_opportunities() daily.

ALTER TYPE public.notification_type
  ADD VALUE IF NOT EXISTS 'opportunity_deadline_passed';

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS deadline_passed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_opportunities_deadline_passed
  ON public.opportunities (deadline, deadline_passed_at)
  WHERE verified = true AND deadline IS NOT NULL;

CREATE OR REPLACE FUNCTION public.flag_expired_opportunities()
RETURNS TABLE (flagged_count integer, notification_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH flagged AS (
    UPDATE public.opportunities
    SET deadline_passed_at = now(),
        updated_at = now()
    WHERE verified = true
      AND deadline IS NOT NULL
      AND deadline < CURRENT_DATE
      AND deadline_passed_at IS NULL
    RETURNING id, title, provider_name, deadline, slug
  ), inserted AS (
    INSERT INTO public.notifications (
      profile_id,
      opportunity_id,
      type,
      metadata
    )
    SELECT
      p.id,
      f.id,
      'opportunity_deadline_passed'::public.notification_type,
      jsonb_build_object(
        'opportunity_id', f.id,
        'title', f.title,
        'provider_name', f.provider_name,
        'deadline', f.deadline,
        'slug', f.slug
      )
    FROM public.profiles p
    CROSS JOIN flagged f
    WHERE p.is_admin = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.profile_id = p.id
          AND n.opportunity_id = f.id
          AND n.type = 'opportunity_deadline_passed'::public.notification_type
      )
    RETURNING id
  )
  SELECT
    (SELECT count(*)::integer FROM flagged),
    (SELECT count(*)::integer FROM inserted)
  INTO flagged_count, notification_count;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_expired_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_expired_opportunities() TO service_role;
