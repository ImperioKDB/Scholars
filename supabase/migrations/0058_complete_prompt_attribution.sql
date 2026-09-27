-- Legacy catalog rows may have no created_by even though their official prompts
-- are seeded by the Scholars editorial/admin layer. Use the protected founder
-- profile as the explicit editorial owner in that case.
CREATE OR REPLACE FUNCTION public.seed_scholarship_prompts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  editor_id uuid;
BEGIN
  SELECT COALESCE(
    NEW.created_by,
    (
      SELECT p.id
      FROM public.profiles p
      WHERE p.is_admin = true AND p.community_role = 'founder'
      ORDER BY p.created_at
      LIMIT 1
    )
  ) INTO editor_id;

  IF NEW.verified IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.verified IS DISTINCT FROM TRUE) THEN
    INSERT INTO public.scholarship_prompts (scholarship_id, prompt_key, prompt_text, sort_order, created_by)
    VALUES
      (NEW.id, 'eligibility-check', format('What should applicants double-check before applying to %s?', NEW.title), 1, editor_id),
      (NEW.id, 'application-experience', 'What was your general application experience like? Please keep personal documents and private details out of your reply.', 2, editor_id),
      (NEW.id, 'next-student-tip', 'What practical tip would you share with the next student exploring this opportunity?', 3, editor_id)
    ON CONFLICT (scholarship_id, prompt_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.scholarship_prompts p
SET created_by = founder.id
FROM (
  SELECT id
  FROM public.profiles
  WHERE is_admin = true AND community_role = 'founder'
  ORDER BY created_at
  LIMIT 1
) AS founder
WHERE p.created_by IS NULL;
