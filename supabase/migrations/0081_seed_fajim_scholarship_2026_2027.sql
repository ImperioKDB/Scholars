-- Publish the FAJIM Medicare Foundation 2026/2027 new-applicant scholarship
-- after checking the supplied Google Form and the provider's official page.
do $migration$
declare
  v_scholarship_id uuid;
begin
  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLSfQI0lLkaDkBhruftNHxkSXhvqtibLFpl1Eef9y7od2KqZirg/viewform'
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
      opens_at,
      last_verified_at
    ) values (
      'FAJIM Medicare Foundation Scholarship 2026/2027',
      'FAJIM Medicare Foundation',
      'Financial support and mentorship for undergraduate students pursuing healthcare careers in Nigerian public universities. New applicants must be enrolled in 200 level and study Medicine, Dentistry, Pharmacy, Nursing, Physiotherapy, Radiography, or Medical Laboratory Science. Financial need and willingness to participate in mentorship, health education, and community service activities are required.',
      'Financial assistance toward education expenses; individual award amount not publicly specified',
      '2026-10-11',
      'https://docs.google.com/forms/d/e/1FAIpQLSfQI0lLkaDkBhruftNHxkSXhvqtibLFpl1Eef9y7od2KqZirg/viewform',
      'undergrad',
      'Medicine, Dentistry, Pharmacy, Nursing, Physiotherapy, Radiography, Medical Laboratory Science',
      true,
      'Verified 2026-10-09 against the provider''s official programme page https://fajimmf.org.ng/home/scholarship/ and the supplied Google Form. The official page states that 2026/2027 new applications are open from 2026-10-05 through 2026-10-11 at 11:59 p.m. WAT, for 200-level students at Nigerian public universities studying the listed healthcare disciplines, with a 5.00/5.00 CGPA or an equivalent accepted by the committee, financial need, and willingness to participate in mentorship, health education, and community service. The official page lists the required documents and confirms financial assistance, mentorship, academic guidance, and community-service opportunities, but does not state an individual award amount. The authenticated supplied form has the title FAJIM Scholarship Application 2026/2027 — New Applicants, identifies FAJIM Medicare Foundation, repeats the eligibility and deadline, and is hosted within fajimmf.org.ng. The official source links a shortened form URL; this record preserves the exact supplied form URL for applicants. The form records the applicant Google account email and requests clear, verifiable information. Applying does not guarantee an award.',
      'Complete the official new-applicant Google Form before 11:59 p.m. WAT on 11 October 2026. Prepare a recent passport-style photograph on a white background, current course registration or official university enrolment-and-level letter, latest transcript or statement of results, Direct Entry results where applicable, and one signed recommendation letter from the Faculty Dean, Sub-Dean, or Head of Department addressed to The Scholarship Committee, FAJIM Medicare Foundation. Apply only through the official form and do not submit the renewal form unless you are already a FAJIM Scholar.',
      '2026-10-05',
      now()
    ) returning id into v_scholarship_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values
      (v_scholarship_id, 'nationality', 'eq', '"Nigerian"'::jsonb),
      (v_scholarship_id, 'year_of_study', 'eq', '200'::jsonb),
      (v_scholarship_id, 'discipline', 'in', '["Medicine", "Dentistry", "Pharmacy", "Nursing", "Physiotherapy", "Radiography", "Medical Laboratory Science"]'::jsonb),
      (v_scholarship_id, 'gpa', 'gte', '5.0'::jsonb),
      (v_scholarship_id, 'financial_need', 'eq', 'true'::jsonb),
      (v_scholarship_id, 'institution_type', 'in', '["federal_uni", "state_uni"]'::jsonb);
  end if;
end
$migration$;
