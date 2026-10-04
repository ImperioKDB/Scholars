-- Publish the 2026 Prince Ukeme Ukpong Mega Foundation tertiary scholarship
-- after checking the supplied official flyer, the foundation's public 2026
-- announcement, the direct Google Form redirect, and an independent Nigerian
-- scholarship reference. The individual award amount is not publicly stated.
do $$
declare
  v_scholarship_id uuid;
begin
  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLScne1KUZltRziF7w9cjt8u1fkNf_TVHwdnfvdFIR6UJbLSZFg/viewform'
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
      'Prince Ukeme Ukpong Mega Foundation 2026 Tertiary Scholarship',
      'Prince Ukeme Ukpong Mega Foundation',
      'A 2026 tertiary scholarship opportunity for undergraduates and students at a similar level who are from Akwa Ibom State and enrolled in a recognized tertiary institution in Nigeria.',
      'Award amount not publicly specified',
      '2026-11-04',
      'https://docs.google.com/forms/d/e/1FAIpQLScne1KUZltRziF7w9cjt8u1fkNf_TVHwdnfvdFIR6UJbLSZFg/viewform',
      'undergrad',
      'All disciplines',
      true,
      'Verified 2026-10-04 against the supplied scholarship flyer, which names the Prince Ukeme Ukpong Mega Foundation and states that applications are open until 2026-11-04 for undergraduates or students at a similar level from Akwa Ibom State studying in recognized tertiary institutions in Nigeria. The flyer links to tinyurl.com/PUUMF2026; the short link was resolved to the Google Form above. The foundation''s official public 2026 announcement at https://www.facebook.com/puumf/posts/18-million-is-coming-prince-ukeme-ukpong-mega-foundation-raises-the-bar-for-2026/122219496146583460/ confirms the 2026 Learn, Excel & Empower programme, ₦18,000,000 committed to scholarships and business grants, and a prior record of 147 tertiary scholarships. The official announcement does not state an individual award amount. An independent 2025 reference at https://www.scholarshipair.com/scholarships/prince-ukeme-ukpong-tertiary-education-scholarship-2025 corroborates the provider''s recurring tertiary scholarship pattern and Akwa Ibom eligibility. The Google Form requires sign-in, so applicants should confirm the form is accepting responses and never pay an application fee unless the foundation publishes an official change.',
      'Apply through the official Google Form linked from the foundation''s flyer. Prepare proof of Akwa Ibom origin, current tertiary enrolment, and supporting academic documents. Confirm the form is accepting responses before submitting, and do not pay anyone to process the application.',
      '2026-10-04',
      now()
    ) returning id into v_scholarship_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values
      (v_scholarship_id, 'nationality', 'eq', '"Nigerian"'::jsonb),
      (v_scholarship_id, 'state_of_origin', 'eq', '"Akwa Ibom"'::jsonb),
      (v_scholarship_id, 'institution_type', 'in', '["federal_uni", "state_uni", "private_uni", "polytechnic", "college_of_education"]'::jsonb);
  end if;
end $$;
