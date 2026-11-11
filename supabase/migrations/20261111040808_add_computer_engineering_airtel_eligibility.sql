-- Computer Engineering is included by the verified Airtel scholarship text
-- as a related technology field. Keep its explicit machine-readable allow-list
-- aligned with that published eligibility wording.
DO $$
BEGIN
  UPDATE public.scholarship_rules
  SET value = value || '["Computer Engineering"]'::jsonb
  WHERE id = '651e4dc9-2a19-4dd9-819a-e57472a5fcf1'
    AND scholarship_id = 'cccccccc-0000-4000-8000-000000000026'
    AND field = 'discipline'
    AND operator = 'in'
    AND jsonb_typeof(value) = 'array'
    AND NOT (value @> '["Computer Engineering"]'::jsonb);

  IF NOT FOUND AND NOT EXISTS (
    SELECT id
    FROM public.scholarship_rules
    WHERE id = '651e4dc9-2a19-4dd9-819a-e57472a5fcf1'
      AND scholarship_id = 'cccccccc-0000-4000-8000-000000000026'
      AND field = 'discipline'
      AND operator = 'in'
      AND value @> '["Computer Engineering"]'::jsonb
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Expected Airtel technology scholarship discipline rule not found or incompatible';
  END IF;
END;
$$;
