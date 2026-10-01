-- Publish the Female Scholars Foundation university scholarship after checking the
-- organisation's official homepage, FAQ, about page, and application form.
-- The official site currently publishes 2026 JAMB criteria but also contains stale
-- 2025 application wording; no fixed current deadline is published, so deadline
-- remains null and the contradiction is preserved in research_notes.

do $$
declare
  v_scholarship_id uuid;
begin
  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLScsMy5sPWa7bi1XCxPHSRZ-g6YcCvnGkhPLC6nbf_VG26Knvw/viewform?usp=publish-editor'
  ) then
    insert into public.scholarships (
      title,
      provider_name,
      description,
      amount,
      deadline,
      application_url,
      level,
      discipline,
      verified,
      research_notes,
      how_to_apply,
      last_verified_at
    ) values (
      'Female Scholars Foundation University Scholarship',
      'Female Scholars Foundation',
      'A full university scholarship for female students from rural communities. The official programme describes support covering tuition, books, and living expenses throughout university, alongside mentorship, coaching, and internship opportunities. Applicants must have graduated from a public secondary school and gained admission into a public university.',
      'Full scholarship: tuition, books, and living expenses',
      null,
      'https://docs.google.com/forms/d/e/1FAIpQLScsMy5sPWa7bi1XCxPHSRZ-g6YcCvnGkhPLC6nbf_VG26Knvw/viewform?usp=publish-editor',
      'undergrad',
      'All disciplines',
      true,
      'Verified 2026-10-01 against the official Female Scholars Foundation homepage https://femalescholars.org/, About Us page https://femalescholars.org/about-us/, FAQ https://femalescholars.org/faq/, and the official application form linked from the homepage. The homepage states that applicants must be female, age 20 or younger, graduates of a public secondary school, admitted to a public university, have a JAMB score of at least 240 for 2026, and have at least five WAEC or NECO distinctions (A1-B3). The homepage describes a full scholarship covering tuition, books, and living expenses; the FAQ further describes tuition, annual accommodation and textbook allowance, monthly stipend, mentorship, networking, and internship/job opportunities. The FAQ still says applications are for 2025 and references an application opening date of 2025-08-01, so the current cycle status and deadline should be reconfirmed with the foundation before applying. No current fixed deadline or award count is published on the checked official pages. Official contact: info@femalescholars.org; +234 707 287 9066.',
      'Review the current eligibility requirements and submit the application through the official Google Form linked on femalescholars.org. Prepare JAMB results, WAEC/NECO results, proof of admission, required academic details, documents, and a motivation essay. The official FAQ says applications are free; do not pay anyone claiming to process the application. Because the FAQ contains stale 2025 wording, confirm that the form is accepting the intended cycle before submitting.',
      now()
    ) returning id into v_scholarship_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values
      (v_scholarship_id, 'gender', 'eq', '"female"'::jsonb),
      (v_scholarship_id, 'age', 'lte', '20'::jsonb),
      (v_scholarship_id, 'nationality', 'eq', '"Nigerian"'::jsonb),
      (v_scholarship_id, 'institution_type', 'in', '["federal_uni", "state_uni"]'::jsonb),
      (v_scholarship_id, 'jamb_score', 'gte', '240'::jsonb),
      (v_scholarship_id, 'waec_credit_count', 'gte', '5'::jsonb);
  end if;
end $$;
