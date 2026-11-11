-- Promote the Airtel Africa Foundation entry to the current 2026/2027
-- scholarship listing and keep the Nigerian eligibility rules explicit.
DO $migration$
DECLARE
  v_scholarship_id uuid := 'cccccccc-0000-4000-8000-000000000026';
BEGIN
  UPDATE public.scholarships
  SET
    title = 'Airtel Africa Foundation Tech Scholarship 2026/2027 - Nigeria',
    provider_name = 'Airtel Africa Foundation',
    description = 'A full undergraduate technology scholarship for eligible Nigerian students entering 100 level at one of the 11 participating public universities named in the 2026/2027 call: University of Lagos (UNILAG), University of Nigeria, Nsukka (UNN), Ahmadu Bello University (ABU), University of Benin (UNIBEN), Obafemi Awolowo University (OAU), University of Ilorin (UNILORIN), Tai Solarin University of Education (TASUED), University of Abuja, University of Uyo (UNIUYO), Federal University of Technology, Owerri (FUTO), and University of Maiduguri (UNIMAID). Eligible technology-related fields include Computer Science, Information Technology, Cybersecurity, Systems Engineering, Software Engineering, and related disciplines.',
    amount = 'Full undergraduate scholarship support including tuition, accommodation, learning materials, stipend, laptop, and connectivity; career readiness and mentorship are also part of the wider fellowship.',
    deadline = '2026-12-04',
    application_url = 'https://apply.theafarainitiative.org/opportunities/airtel-africa-foundation-tech-scholarship-2026-2027-nigeria',
    level = 'undergrad',
    discipline = 'Computer Science, Information Technology, Cybersecurity, Systems Engineering, Software Engineering, and related technology fields',
    verified = true,
    how_to_apply = 'Apply through the live Nigeria application page at https://apply.theafarainitiative.org/opportunities/airtel-africa-foundation-tech-scholarship-2026-2027-nigeria before 4 December 2026. Applicants must be entering 100 level and attend one of the 11 eligible public universities listed in the scholarship description. Review the form requirements before submitting personal information.',
    research_notes = COALESCE(research_notes, '') || E'\n\nUpdated 2026-11-09 at the user''s request. The Airtel scholarship must be treated as a scholarship, not only as a general fellowship opportunity. The supplied live application page displays "Airtel Africa Foundation Tech Fellowship 2026/2027: Nigeria", identifies Nigeria, and closes 4 December 2026. The 2026/2027 Nigerian call list records 11 eligible public universities: UNILAG, UNN, ABU, UNIBEN, OAU, UNILORIN, TASUED, University of Abuja, UNIUYO, FUTO, and UNIMAID. Critical eligibility rule: only 100-level entrants can apply. The scholarship record and matching rules reflect that restriction.'
  WHERE id = v_scholarship_id;

  UPDATE public.scholarship_rules
  SET operator = 'in', value = '["federal_uni", "state_uni"]'::jsonb, gating = true
  WHERE scholarship_id = v_scholarship_id
    AND field = 'institution_type';

  IF NOT EXISTS (
    SELECT 1 FROM public.scholarship_rules
    WHERE scholarship_id = v_scholarship_id
      AND field = 'year_of_study'
      AND operator = 'eq'
      AND value = '100'::jsonb
    LIMIT 1
  ) THEN
    INSERT INTO public.scholarship_rules (scholarship_id, field, operator, value, gating)
    VALUES (v_scholarship_id, 'year_of_study', 'eq', '100'::jsonb, true);
  END IF;
END
$migration$;
