-- Preserve the editor/creator attribution already present on scholarship records.
CREATE OR REPLACE FUNCTION public.seed_scholarship_prompts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.verified IS DISTINCT FROM TRUE) THEN
    INSERT INTO public.scholarship_prompts (scholarship_id, prompt_key, prompt_text, sort_order, created_by)
    VALUES
      (NEW.id, 'eligibility-check', format('What should applicants double-check before applying to %s?', NEW.title), 1, NEW.created_by),
      (NEW.id, 'application-experience', 'What was your general application experience like? Please keep personal documents and private details out of your reply.', 2, NEW.created_by),
      (NEW.id, 'next-student-tip', 'What practical tip would you share with the next student exploring this opportunity?', 3, NEW.created_by)
    ON CONFLICT (scholarship_id, prompt_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.scholarship_prompts p
SET created_by = s.created_by
FROM public.scholarships s
WHERE p.scholarship_id = s.id
  AND p.created_by IS NULL
  AND s.created_by IS NOT NULL;
