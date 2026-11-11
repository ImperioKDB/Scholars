-- Re-verify the two user-supplied source pages without creating duplicates.
DO $migration$
BEGIN
  UPDATE public.opportunities
  SET
    research_notes = COALESCE(research_notes, '') || E'\n\nRe-verified 2026-11-09 against the supplied Icanstudent listing: https://www.icanstudent.com/kayode-aderinokun-poetry-prize-2026/. The page confirms the LABAF 2026 poetry and spoken-word competition, Freedom Park Lagos event dates of 18–19 November 2026, the five-minute poetry-video/social-media entry format, and prizes of ₦1,000,000, ₦500,000, and ₦300,000 plus unspecified jury special prizes. It does not publish a final submission deadline, so deadline remains null.'
  WHERE id = '1d8476f9-5732-4582-ac09-5dcceb7d2be5';

  UPDATE public.scholarships
  SET
    research_notes = COALESCE(research_notes, '') || E'\n\nRe-verified 2026-11-09 against the supplied legacy Scholastica URL: https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo25. That page identifies the 2025 application period as ended but displays the 2026 NNPC-SNEPCo National University Scholarship details, including the 30 November 2026 deadline, Nigerian citizenship, full-time 200-level study in a public NUC-accredited university, minimum 3.5 CGPA on a 5-point scale or equivalent, and no-fee application. The active application route remains the canonical 2026 page at https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26.'
  WHERE id = '4a8ab8cd-9810-4478-9e80-0bf4eeb12995';
END
$migration$;
