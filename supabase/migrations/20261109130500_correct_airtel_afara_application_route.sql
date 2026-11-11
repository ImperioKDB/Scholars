-- Correct the verified Airtel Africa Foundation opportunity from the live
-- Nigeria application page supplied for the 2026/2027 cycle.
DO $migration$
BEGIN
  UPDATE public.opportunities
  SET
    title = 'Airtel Africa Foundation Tech Fellowship 2026/2027: Nigeria',
    type = 'fellowship',
    provider_name = 'Airtel Africa Foundation',
    deadline = '2026-12-04',
    application_url = 'https://apply.theafarainitiative.org/opportunities/airtel-africa-foundation-tech-scholarship-2026-2027-nigeria',
    how_to_apply = 'Apply through the live Nigeria application page at https://apply.theafarainitiative.org/opportunities/airtel-africa-foundation-tech-scholarship-2026-2027-nigeria. The page currently displays a closing date of 4 December 2026. Applicants should review the form requirements before submitting personal information.',
    research_notes = COALESCE(research_notes, '') || E'\n\nRe-verified 2026-11-09 against the supplied live application page: the rendered listing is titled "Airtel Africa Foundation Tech Fellowship 2026/2027: Nigeria", names Airtel Africa Foundation, identifies Nigeria, and displays "Closes 4 Dec 2026". The official Foundation education page corroborates the wider fellowship as a full STEM scholarship for high-potential African students from low-income backgrounds, with financial support, career readiness, mentorship, and real-world exposure. The active application URL is the Afara Initiative form supplied by the user.'
  WHERE id = 'fed9dea3-e62a-4c5c-af77-f0aabfc20f90';
END
$migration$;
