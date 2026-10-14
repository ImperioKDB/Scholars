-- Refresh and publish user-requested 2026 opportunities after primary-source
-- verification on 2026-10-14. The Pension Literacy competition is already
-- present in public.opportunities (migration 0083), so it is not duplicated
-- as a scholarship. Closed or insufficiently verified cycles are omitted.
do $migration$
declare
  v_id uuid;
begin
  -- Yinka & Pelumi Foundation: use the official current application route.
  select id into v_id
  from public.scholarships
  where application_url = 'https://ypscholarshipfoundation.com/apply'
     or lower(title) = lower('Yinka & Pelumi Foundation Undergraduate Scholarship 2026')
  order by created_at desc
  limit 1;
  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, last_verified_at
    ) values (
      'Yinka & Pelumi Foundation Undergraduate Scholarship 2026',
      'Yinka & Pelumi Foundation',
      'The 2026 Foundation Scholars Programme supports undergraduates of Obafemi Awolowo University studying Electrical Engineering or Mechanical Engineering in levels 100 through 500. The official programme lists ₦200,000 toward tuition for the session, ₦200,000 toward accommodation, and ₦50,000 each semester for academic materials, plus conferences and career mentorship. Current beneficiaries of another scholarship are ineligible.',
      '₦200,000 toward tuition + ₦200,000 toward accommodation + ₦50,000/semester for academic materials',
      '2026-10-25',
      'https://ypscholarshipfoundation.com/apply',
      'undergrad', null, true,
      'Verified 2026-10-14 against the official Yinka & Pelumi Foundation Scholars Programme https://ypscholarshipfoundation.com/programs/scholars, official application portal https://ypscholarshipfoundation.com/apply, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10241. The official page confirms OAU undergraduate eligibility in Electrical or Mechanical Engineering, 100–500 level, disqualification for current beneficiaries of another scholarship, ₦200,000 tuition support, ₦200,000 accommodation support, ₦50,000 each semester for academic materials, conferences and mentorship; it states the deadline is 2026-10-25. ScholarshipAir lists the same deadline but omits the accommodation award; the official programme page is authoritative. The opening date is not stated. OAU institution identity and other-scholarship status are not tracked in the student profile and must be checked manually.',
      'Apply through the Foundation’s official portal before 25 October 2026. Applicants must be undergraduates at Obafemi Awolowo University studying Electrical Engineering or Mechanical Engineering in levels 100–500, and must not currently receive another scholarship. Prepare the Post-UTME aggregate slip for 100 level, or the OAU eportal transcript for levels 200–500, plus a personal essay and signed personal letter of attestation for character. Each document may be PDF, JPEG, or PNG up to 10 MB. Use the Foundation’s character-letter template and verify details on the portal before submitting.',
      null, now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Yinka & Pelumi Foundation Undergraduate Scholarship 2026',
      provider_name = 'Yinka & Pelumi Foundation',
      description = 'The 2026 Foundation Scholars Programme supports undergraduates of Obafemi Awolowo University studying Electrical Engineering or Mechanical Engineering in levels 100 through 500. The official programme lists ₦200,000 toward tuition for the session, ₦200,000 toward accommodation, and ₦50,000 each semester for academic materials, plus conferences and career mentorship. Current beneficiaries of another scholarship are ineligible.',
      amount = '₦200,000 toward tuition + ₦200,000 toward accommodation + ₦50,000/semester for academic materials',
      deadline = '2026-10-25',
      application_url = 'https://ypscholarshipfoundation.com/apply',
      level = 'undergrad', discipline = null,
      research_notes = 'Verified 2026-10-14 against the official Yinka & Pelumi Foundation Scholars Programme https://ypscholarshipfoundation.com/programs/scholars, official application portal https://ypscholarshipfoundation.com/apply, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10241. The official page confirms OAU undergraduate eligibility in Electrical or Mechanical Engineering, 100–500 level, disqualification for current beneficiaries of another scholarship, ₦200,000 tuition support, ₦200,000 accommodation support, ₦50,000 each semester for academic materials, conferences and mentorship; it states the deadline is 2026-10-25. ScholarshipAir lists the same deadline but omits the accommodation award; the official programme page is authoritative. The opening date is not stated. OAU institution identity and other-scholarship status are not tracked in the student profile and must be checked manually.',
      how_to_apply = 'Apply through the Foundation’s official portal before 25 October 2026. Applicants must be undergraduates at Obafemi Awolowo University studying Electrical Engineering or Mechanical Engineering in levels 100–500, and must not currently receive another scholarship. Prepare the Post-UTME aggregate slip for 100 level, or the OAU eportal transcript for levels 200–500, plus a personal essay and signed personal letter of attestation for character. Each document may be PDF, JPEG, or PNG up to 10 MB. Use the Foundation’s character-letter template and verify details on the portal before submitting.',
      opens_at = null, last_verified_at = now()
    where id = v_id;
  end if;

  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'discipline' and operator = 'in' and value = '["Electrical Engineering", "Mechanical Engineering"]'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'discipline', 'in', '["Electrical Engineering", "Mechanical Engineering"]'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'year_of_study' and operator = 'gte' and value = '100'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'year_of_study', 'gte', '100'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'year_of_study' and operator = 'lte' and value = '500'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'year_of_study', 'lte', '500'::jsonb, true);
  end if;

  -- Carewave: refresh the existing CASP row instead of creating a duplicate.
  select id into v_id
  from public.scholarships
  where application_url = 'https://portal.carewavefoundation.org/scholarships/apply?scholarshipId=SCH-2026-946543'
     or (lower(title) like '%carewave%' and lower(provider_name) like '%care%')
  order by created_at desc
  limit 1;
  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, awards_available, last_verified_at
    ) values (
      'Carewave ASPIRE Scholarship Programme (CASP) 2026',
      'Carewave Foundation',
      'A merit- and need-based scholarship for Nigerian undergraduates aged 18–25 at Federal Universities, especially students facing financial disadvantage. The 2026 programme provides tuition coverage and a living stipend, with NGN 500,000 yearly support and 20 available awards. Initial support is for one academic year and may be renewed based on performance and programme requirements. It also offers mentorship, leadership development and career guidance. Eligible course areas are listed on the official Foundation page.',
      '₦500,000 per year; tuition coverage and living stipend',
      '2026-11-09',
      'https://portal.carewavefoundation.org/scholarships/apply?scholarshipId=SCH-2026-946543',
      'undergrad', null, true,
      'Verified 2026-10-14 against Carewave Foundation’s official scholarship page https://carewavefoundation.org/scholarships/SCH-2026-946543, official application terms https://portal.carewavefoundation.org/scholarships/apply?scholarshipId=SCH-2026-946543, and supplied ScholarshipAir page https://www.scholarshipair.com/s/10203. The official page states applications opened 2026-01-01 and close 2026-11-09; 20 awards; NGN 500,000 yearly, tuition and living support; Nigerian Federal University undergraduate applicants aged 18–25 with financial need and strong academics. The official portal displayed programme terms and a Continue to Application step; no personal data was entered and no application submitted. The terms screen notes award details will be communicated to selected applicants, while the official programme page states NGN 500,000 yearly.',
      'Apply through the official Carewave scholarship portal before 9 November 2026. Review the terms and eligibility. Prepare your admission letter, JAMB admission letter and score slip, two recommendation letters, WAEC/NECO result, birth certificate, local-government identification, NIMC slip, motivational letter and proof of financial need. Confirm any additional requests shown in the portal. Do not pay an intermediary or share account credentials outside official Carewave channels.',
      '2026-01-01', 20, now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Carewave ASPIRE Scholarship Programme (CASP) 2026',
      provider_name = 'Carewave Foundation',
      description = 'A merit- and need-based scholarship for Nigerian undergraduates aged 18–25 at Federal Universities, especially students facing financial disadvantage. The 2026 programme provides tuition coverage and a living stipend, with NGN 500,000 yearly support and 20 available awards. Initial support is for one academic year and may be renewed based on performance and programme requirements. It also offers mentorship, leadership development and career guidance. Eligible course areas are listed on the official Foundation page.',
      amount = '₦500,000 per year; tuition coverage and living stipend',
      deadline = '2026-11-09',
      application_url = 'https://portal.carewavefoundation.org/scholarships/apply?scholarshipId=SCH-2026-946543',
      level = 'undergrad', discipline = null,
      research_notes = 'Verified 2026-10-14 against Carewave Foundation’s official scholarship page https://carewavefoundation.org/scholarships/SCH-2026-946543, official application terms https://portal.carewavefoundation.org/scholarships/apply?scholarshipId=SCH-2026-946543, and supplied ScholarshipAir page https://www.scholarshipair.com/s/10203. The official page states applications opened 2026-01-01 and close 2026-11-09; 20 awards; NGN 500,000 yearly, tuition and living support; Nigerian Federal University undergraduate applicants aged 18–25 with financial need and strong academics. The official portal displayed programme terms and a Continue to Application step; no personal data was entered and no application submitted. The terms screen notes award details will be communicated to selected applicants, while the official programme page states NGN 500,000 yearly.',
      how_to_apply = 'Apply through the official Carewave scholarship portal before 9 November 2026. Review the terms and eligibility. Prepare your admission letter, JAMB admission letter and score slip, two recommendation letters, WAEC/NECO result, birth certificate, local-government identification, NIMC slip, motivational letter and proof of financial need. Confirm any additional requests shown in the portal. Do not pay an intermediary or share account credentials outside official Carewave channels.',
      opens_at = '2026-01-01', awards_available = 20, last_verified_at = now()
    where id = v_id;
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'nationality' and operator = 'eq' and value = '"Nigerian"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'nationality', 'eq', '"Nigerian"'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'age' and operator = 'gte' and value = '18'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'age', 'gte', '18'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'age' and operator = 'lte' and value = '25'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'age', 'lte', '25'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'financial_need' and operator = 'eq' and value = 'true'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'financial_need', 'eq', 'true'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'institution_type' and operator = 'eq' and value = '"federal_uni"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'institution_type', 'eq', '"federal_uni"'::jsonb, true);
  end if;

  -- Female Scholars Foundation: refresh current 2026 dates and requirements.
  select id into v_id
  from public.scholarships
  where application_url like 'https://docs.google.com/forms/d/e/1FAIpQLScsMy5sPWa7bi1XCxPHSRZ-g6YcCvnGkhPLC6nbf_VG26Knvw/viewform%'
     or (lower(title) like '%female scholars foundation university scholarship%' and lower(provider_name) like '%female scholars%')
  order by created_at desc
  limit 1;
  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, last_verified_at
    ) values (
      'Female Scholars Foundation University Scholarship 2026',
      'Female Scholars Foundation',
      'A full university scholarship for female students aged 20 or younger who graduated from a public secondary school and gained admission to a public university. The 2026 criteria include a JAMB score of at least 240 and at least five distinctions (A1–B3) in WAEC or NECO. Support includes tuition, books and living expenses, plus mentorship, coaching and internship opportunities. The official FAQ describes accommodation and textbook allowances and a monthly stipend; no fixed cash amount is published.',
      'Full scholarship: tuition, books and living expenses; no fixed cash amount stated',
      '2026-12-31',
      'https://docs.google.com/forms/d/e/1FAIpQLScsMy5sPWa7bi1XCxPHSRZ-g6YcCvnGkhPLC6nbf_VG26Knvw/viewform?usp=publish-editor',
      'undergrad', 'All disciplines', true,
      'Verified 2026-10-14 against the official Female Scholars Foundation homepage https://femalescholars.org/, FAQ https://femalescholars.org/faq/, linked application form, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10212. The homepage states 2026 applications are being accepted from 2026-10-01 through 2026-12-31. Criteria: female, age 20 or younger, public-secondary-school graduate, admitted to a public university, JAMB at least 240, and five A1–B3 distinctions in WAEC or NECO. The official page accepts NECO as an alternative; ScholarshipAir mentions WAEC only. The official FAQ details accommodation/textbook allowance, monthly stipend, mentoring and internship support. The separate /apply-now page contains stale 2024 information and was not used for current dates. The Google Form showed a sign-in interstitial, so its question-level details were not independently inspected; no personal data was entered.',
      'Apply free using the form linked from the official Female Scholars Foundation site before 31 December 2026. Prepare WAEC, NECO or GCE results, JAMB result, proof of admission (JAMB portal admission-status screenshot is accepted if the letter is not yet available), and the application essay; have supporting academic details ready. Check that the official form is accepting submissions before applying. Do not pay an intermediary.',
      '2026-10-01', now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Female Scholars Foundation University Scholarship 2026',
      provider_name = 'Female Scholars Foundation',
      description = 'A full university scholarship for female students aged 20 or younger who graduated from a public secondary school and gained admission to a public university. The 2026 criteria include a JAMB score of at least 240 and at least five distinctions (A1–B3) in WAEC or NECO. Support includes tuition, books and living expenses, plus mentorship, coaching and internship opportunities. The official FAQ describes accommodation and textbook allowances and a monthly stipend; no fixed cash amount is published.',
      amount = 'Full scholarship: tuition, books and living expenses; no fixed cash amount stated',
      deadline = '2026-12-31',
      application_url = 'https://docs.google.com/forms/d/e/1FAIpQLScsMy5sPWa7bi1XCxPHSRZ-g6YcCvnGkhPLC6nbf_VG26Knvw/viewform?usp=publish-editor',
      level = 'undergrad', discipline = 'All disciplines',
      research_notes = 'Verified 2026-10-14 against the official Female Scholars Foundation homepage https://femalescholars.org/, FAQ https://femalescholars.org/faq/, linked application form, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10212. The homepage states 2026 applications are being accepted from 2026-10-01 through 2026-12-31. Criteria: female, age 20 or younger, public-secondary-school graduate, admitted to a public university, JAMB at least 240, and five A1–B3 distinctions in WAEC or NECO. The official page accepts NECO as an alternative; ScholarshipAir mentions WAEC only. The official FAQ details accommodation/textbook allowance, monthly stipend, mentoring and internship support. The separate /apply-now page contains stale 2024 information and was not used for current dates. The Google Form showed a sign-in interstitial, so its question-level details were not independently inspected; no personal data was entered.',
      how_to_apply = 'Apply free using the form linked from the official Female Scholars Foundation site before 31 December 2026. Prepare WAEC, NECO or GCE results, JAMB result, proof of admission (JAMB portal admission-status screenshot is accepted if the letter is not yet available), and the application essay; have supporting academic details ready. Check that the official form is accepting submissions before applying. Do not pay an intermediary.',
      opens_at = '2026-10-01', last_verified_at = now()
    where id = v_id;
  end if;
  -- The previous verification already created these; the checks also make
  -- this seed safe in a database restored without its rule rows.
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'gender' and operator = 'eq' and value = '"female"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'gender', 'eq', '"female"'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'age' and operator = 'lte' and value = '20'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'age', 'lte', '20'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'nationality' and operator = 'eq' and value = '"Nigerian"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'nationality', 'eq', '"Nigerian"'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'institution_type' and operator = 'in' and value = '["federal_uni", "state_uni"]'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'institution_type', 'in', '["federal_uni", "state_uni"]'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'jamb_score' and operator = 'gte' and value = '240'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'jamb_score', 'gte', '240'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'waec_credit_count' and operator = 'gte' and value = '5'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'waec_credit_count', 'gte', '5'::jsonb, true);
  end if;

  -- Osun Indigenes Organization USA Chapter: current official 2026/27 PDF.
  select id into v_id
  from public.scholarships
  where application_url = 'https://osunindigenes.net/wp-content/uploads/2026/09/SCHOLARSHIP_FORM_YEAR-2026-27.pdf'
     or lower(title) = lower('Osun Indigenes Scholarship 2026/2027')
  order by created_at desc
  limit 1;
  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, last_verified_at
    ) values (
      'Osun Indigenes Scholarship 2026/2027',
      'Osun Indigenes Organization U.S.A. (USA Chapter)',
      'Financial assistance for students from Osun State who are admitted to a college or university and enrolled full-time. Applicants must demonstrate financial need and self-discipline, including good academic standing. The official form says funds are disbursed directly to the recipient’s school; no award amount is stated.',
      'Amount not stated on the official 2026/2027 application form',
      '2026-10-22',
      'https://osunindigenes.net/wp-content/uploads/2026/09/SCHOLARSHIP_FORM_YEAR-2026-27.pdf',
      'undergrad', null, true,
      'Verified 2026-10-14 against the supplied ScholarshipAir listing https://www.scholarshipair.com/s/10200, the official 2026/2027 application PDF https://osunindigenes.net/wp-content/uploads/2026/09/SCHOLARSHIP_FORM_YEAR-2026-27.pdf, and sponsor page https://osunindigenes.net/scholarship/. The sponsor-hosted PDF identifies the fiscal year 2026/2027, states a 2026-10-22 submission deadline, eligibility for Osun State students admitted to college or university and enrolled full-time with financial need and good standing, direct school disbursement, email submission, and supporting materials. It does not state an award amount or opening date.',
      'Download and complete the official 2026/2027 form and email it with the supporting documents to toiog.scholarship@osunindigenes.net before 22 October 2026. The official package includes a two-page typed, double-spaced essay on “How to make a difference in my community”; three recommendation letters (religious/community leader, teacher, and Local Government); recent passport photos; most recent transcript; and birth certificate. Follow the official PDF instructions and retain confirmation of submission.',
      null, now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Osun Indigenes Scholarship 2026/2027',
      provider_name = 'Osun Indigenes Organization U.S.A. (USA Chapter)',
      description = 'Financial assistance for students from Osun State who are admitted to a college or university and enrolled full-time. Applicants must demonstrate financial need and self-discipline, including good academic standing. The official form says funds are disbursed directly to the recipient’s school; no award amount is stated.',
      amount = 'Amount not stated on the official 2026/2027 application form',
      deadline = '2026-10-22',
      application_url = 'https://osunindigenes.net/wp-content/uploads/2026/09/SCHOLARSHIP_FORM_YEAR-2026-27.pdf',
      level = 'undergrad', discipline = null,
      research_notes = 'Verified 2026-10-14 against the supplied ScholarshipAir listing https://www.scholarshipair.com/s/10200, the official 2026/2027 application PDF https://osunindigenes.net/wp-content/uploads/2026/09/SCHOLARSHIP_FORM_YEAR-2026-27.pdf, and sponsor page https://osunindigenes.net/scholarship/. The sponsor-hosted PDF identifies the fiscal year 2026/2027, states a 2026-10-22 submission deadline, eligibility for Osun State students admitted to college or university and enrolled full-time with financial need and good standing, direct school disbursement, email submission, and supporting materials. It does not state an award amount or opening date.',
      how_to_apply = 'Download and complete the official 2026/2027 form and email it with the supporting documents to toiog.scholarship@osunindigenes.net before 22 October 2026. The official package includes a two-page typed, double-spaced essay on “How to make a difference in my community”; three recommendation letters (religious/community leader, teacher, and Local Government); recent passport photos; most recent transcript; and birth certificate. Follow the official PDF instructions and retain confirmation of submission.',
      opens_at = null, last_verified_at = now()
    where id = v_id;
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'state_of_origin' and operator = 'eq' and value = '"Osun"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'state_of_origin', 'eq', '"Osun"'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'financial_need' and operator = 'eq' and value = 'true'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'financial_need', 'eq', 'true'::jsonb, true);
  end if;

  -- White Avenue: retain the existing public slug; current official page
  -- confirms the close date but does not publish a benefit amount.
  select id into v_id
  from public.scholarships
  where slug = 'the-icon-scholarship-2026'
     or (lower(provider_name) like '%white avenue%' and lower(title) like '%icon%')
  order by created_at desc
  limit 1;
  if v_id is not null then
    update public.scholarships set
      title = 'White Avenue Group ICON Scholarship for Undergraduates 2026',
      description = 'The ICON Scholarship 2026 is for newly admitted Nigerian university students from any of Nigeria’s 36 states or the FCT. The official sponsor page confirms eligibility, documents, free application and the deadline, but does not specify the award amount or exact benefit value.',
      amount = null,
      deadline = '2026-11-15',
      application_url = 'https://forms.gle/1nDZZxm3khrqJMMh9',
      how_to_apply = 'Apply free through the form linked from White Avenue Group’s official scholarship page. Prepare a valid means of identification, university admission letter, WAEC/NECO result, JAMB result slip, birth certificate, and a short letter about yourself. The official form redirected to a Google sign-in screen during checking, so confirm it accepts submissions before applying. The sponsor page does not state an award amount.',
      research_notes = 'Verified 2026-10-14 against the official White Avenue Group ICON Scholarship page https://whiteavenuegroup.com/the-icon-scholarship/, official form link https://forms.gle/1nDZZxm3khrqJMMh9, and ScholarshipAir listing https://www.scholarshipair.com/s/10198. The sponsor states the 2026 close date is 2026-11-15, the programme is for newly admitted Nigerian university students from all 36 states and the FCT, and the application is free. The sponsor page lists required documents but does not specify the award value or state tuition coverage. The form redirected to Google sign-in; submission acceptance could not be observed. No personal information was entered.',
      opens_at = null, last_verified_at = now()
    where id = v_id;
  end if;

  -- Prince Ukeme: official foundation post confirms the current application
  -- was open on 2026-10-04; no exact official deadline was found, so clear
  -- the aggregator-only date rather than present it as confirmed.
  select id into v_id
  from public.scholarships
  where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLScne1KUZltRziF7w9cjt8u1fkNf_TVHwdnfvdFIR6UJbLSZFg/viewform'
     or lower(title) like '%prince ukeme ukpong%'
  order by created_at desc
  limit 1;
  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, last_verified_at
    ) values (
      'Prince Ukeme Ukpong Mega Foundation 2026 Tertiary Scholarship',
      'Prince Ukeme Ukpong Mega Foundation',
      'A 2026 tertiary education scholarship for deserving students from Akwa Ibom State who are enrolled in tertiary institutions in Nigeria and have genuine financial need. The accessible official 2026 announcement does not state the individual award amount or exact deadline.',
      'Award amount not stated by the official announcement', null,
      'https://tinyurl.com/PUUMF2026', 'undergrad', 'All disciplines', true,
      'Verified 2026-10-14 against the official Prince Ukeme Ukpong Mega Foundation post https://www.facebook.com/puumf/posts/your-education-matters-your-next-step-matters-tooapplications-are-now-open-for-t/122219784020583460/, related official post https://www.facebook.com/puumf/posts/tomorrow-a-new-opportunity-opensbefore-you-apply-for-the-prince-ukeme-ukpong-edu/122219740034583460/, official application link https://tinyurl.com/PUUMF2026, and supplied ScholarshipAir page https://www.scholarshipair.com/scholarships/prince-ukeme-ukpong-mega-foundation-scholarship-2026. The foundation post dated 2026-10-04 says applications are open and describes deserving Akwa Ibom tertiary students with financial need. The official post does not confirm the exact 2026-11-04 deadline, individual award amount, or all category/document details listed by ScholarshipAir. The linked Google Form displayed a sign-in screen, so response acceptance and form fields could not be inspected. Confirm the deadline and application requirements with the foundation before applying.',
      'Use the foundation’s official application link and confirm directly with the foundation that the form is accepting submissions and verify the closing date and required documents before applying. The accessible official announcement confirms the current opportunity is for deserving Akwa Ibom students in Nigerian tertiary institutions with financial need, but does not state an individual award amount or exact deadline. Do not pay an intermediary.',
      null, now()
    ) returning id into v_id;
  else
    update public.scholarships set
      description = 'A 2026 tertiary education scholarship for deserving students from Akwa Ibom State who are enrolled in tertiary institutions in Nigeria and have genuine financial need. The accessible official 2026 announcement does not state the individual award amount or exact deadline.',
      amount = 'Award amount not stated by the official announcement',
      deadline = null,
      application_url = 'https://tinyurl.com/PUUMF2026',
      how_to_apply = 'Use the foundation’s official application link and confirm directly with the foundation that the form is accepting submissions and verify the closing date and required documents before applying. The accessible official announcement confirms the current opportunity is for deserving Akwa Ibom students in Nigerian tertiary institutions with financial need, but does not state an individual award amount or exact deadline. Do not pay an intermediary.',
      research_notes = 'Verified 2026-10-14 against the official Prince Ukeme Ukpong Mega Foundation post https://www.facebook.com/puumf/posts/your-education-matters-your-next-step-matters-tooapplications-are-now-open-for-t/122219784020583460/, related official post https://www.facebook.com/puumf/posts/tomorrow-a-new-opportunity-opensbefore-you-apply-for-the-prince-ukeme-ukpong-edu/122219740034583460/, official application link https://tinyurl.com/PUUMF2026, and supplied ScholarshipAir page https://www.scholarshipair.com/scholarships/prince-ukeme-ukpong-mega-foundation-scholarship-2026. The foundation post dated 2026-10-04 says applications are open and describes deserving Akwa Ibom tertiary students with financial need. The official post does not confirm the exact 2026-11-04 deadline, individual award amount, or all category/document details listed by ScholarshipAir. The linked Google Form displayed a sign-in screen, so response acceptance and form fields could not be inspected. Confirm the deadline and application requirements with the foundation before applying.',
      opens_at = null, last_verified_at = now()
    where id = v_id;
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'state_of_origin' and operator = 'eq' and value = '"Akwa Ibom"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'state_of_origin', 'eq', '"Akwa Ibom"'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'financial_need' and operator = 'eq' and value = 'true'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating) values (v_id, 'financial_need', 'eq', 'true'::jsonb, true);
  end if;
end
$migration$;
