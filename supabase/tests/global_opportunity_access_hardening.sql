-- Run only against a local/isolated Supabase database after applying the
-- feature-branch migration. This script reads ACL/catalog metadata only.
DO $$
DECLARE
  restricted_columns text[] := ARRAY[
    'description', 'eligibility_notes', 'application_url', 'how_to_apply',
    'research_notes', 'deadline_passed_at'
  ];
BEGIN
  IF has_table_privilege('anon', 'public.opportunities', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still SELECT the opportunities base table';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.opportunities', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost SELECT on opportunities';
  END IF;
  IF NOT has_table_privilege('anon', 'public.opportunities_public_preview_v1', 'SELECT') THEN
    RAISE EXCEPTION 'anon cannot SELECT the opportunity preview view';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities_public_preview_v1'
      AND column_name = ANY (restricted_columns)
  ) THEN
    RAISE EXCEPTION 'opportunity preview view contains a restricted column';
  END IF;
  IF NOT has_column_privilege('anon', 'public.opportunities', 'title', 'SELECT')
     OR has_column_privilege('anon', 'public.opportunities', 'description', 'SELECT')
     OR has_column_privilege('anon', 'public.opportunities', 'application_url', 'SELECT') THEN
    RAISE EXCEPTION 'opportunity source-column grants are not restricted as expected';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'opportunities_public_preview_v1'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION 'opportunity preview view is not SECURITY INVOKER';
  END IF;

  IF has_table_privilege('anon', 'public.scholarships', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still SELECT the scholarships base table';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.scholarships', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost SELECT on scholarships';
  END IF;
  IF NOT has_table_privilege('anon', 'public.scholarships_public_preview_v1', 'SELECT') THEN
    RAISE EXCEPTION 'anon cannot SELECT the scholarship preview view';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scholarships_public_preview_v1'
      AND column_name = ANY (restricted_columns)
  ) THEN
    RAISE EXCEPTION 'scholarship preview view contains a restricted column';
  END IF;
  IF NOT has_column_privilege('anon', 'public.scholarships', 'title', 'SELECT')
     OR has_column_privilege('anon', 'public.scholarships', 'description', 'SELECT')
     OR has_column_privilege('anon', 'public.scholarships', 'application_url', 'SELECT') THEN
    RAISE EXCEPTION 'scholarship source-column grants are not restricted as expected';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'scholarships_public_preview_v1'
      AND c.reloptions @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION 'scholarship preview view is not SECURITY INVOKER';
  END IF;
  IF has_table_privilege('anon', 'public.scholarship_rules', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still SELECT structured scholarship eligibility rules';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.scholarship_rules', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost SELECT on scholarship_rules used by matching';
  END IF;

  IF has_table_privilege('anon', 'public.scholarship_discussions', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still SELECT scholarship discussions';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.scholarship_discussions', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost SELECT on scholarship discussions';
  END IF;
  IF has_table_privilege('anon', 'public.scholarship_prompts', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still SELECT scholarship prompts';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.scholarship_prompts', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost SELECT on scholarship prompts';
  END IF;

  IF has_function_privilege(
    'anon', 'public.get_scholarship_discussions(uuid,text,integer)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can still execute get_scholarship_discussions';
  END IF;
  IF NOT has_function_privilege(
    'authenticated', 'public.get_scholarship_discussions(uuid,text,integer)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated lost get_scholarship_discussions';
  END IF;
  IF has_function_privilege(
    'anon', 'public.get_scholarship_social_proof(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can still execute get_scholarship_social_proof';
  END IF;
  IF NOT has_function_privilege(
    'authenticated', 'public.get_scholarship_social_proof(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated lost get_scholarship_social_proof';
  END IF;

  -- These explicitly public APIs intentionally expose only privacy-filtered
  -- profiles for published, non-anonymous community contributions.
  IF NOT has_function_privilege(
    'anon', 'public.get_community_contributor_profile(uuid)', 'EXECUTE'
  ) OR NOT has_function_privilege(
    'anon', 'public.get_public_contributor_profile(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'a deliberately public contributor-profile RPC was disabled';
  END IF;
END;
$$;
