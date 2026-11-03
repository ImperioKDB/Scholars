-- Publish the two user-supplied ScholarshipAir listings after verification.
-- Fisayo Soyombo is an essay competition and belongs in public.opportunities.
-- M. Kukoyi is an undergraduate scholarship and belongs in public.scholarships.
-- Both records are keyed by title/application URL so reapplying this migration
-- updates rather than duplicates them.
do $migration$
declare
  v_opportunity_id uuid;
  v_scholarship_id uuid;
begin
  -- Fisayo Soyombo Essay Contest for Undergraduates 2026.
  select id into v_opportunity_id
  from public.opportunities
  where lower(title) in (
    lower('Fisayo Soyombo Essay Contest for Undergraduates 2026'),
    lower('Fisayo Soyombo Inter-Varsity Essay Competition 2026'),
    lower('9th Annual Fisayo Soyombo Inter-Varsity Essay Competition')
  )
  order by created_at desc
  limit 1;

  if v_opportunity_id is null then
    insert into public.opportunities (
      type,
      title,
      provider_name,
      description,
      eligibility_notes,
      duration,
      location,
      compensation,
      discipline,
      deadline,
      opens_at,
      application_url,
      how_to_apply,
      verified,
      research_notes
    ) values (
      'competition',
      'Fisayo Soyombo Essay Contest for Undergraduates 2026',
      'Union of Campus Journalists',
      'An essay contest for undergraduate students at Nigerian universities examining Nigeria’s public education crisis ahead of the 2027 general elections.',
      'Open to undergraduate university students in Nigeria. Applicants must write on “Who Fails When Schools Fail? Practical Solutions to Nigeria’s Public Education Crisis”, submit 1,500–2,000 words in Times New Roman 12-point font with 1.5 line spacing, and attach a valid school ID card.',
      'Online essay submission; winners are selected after the submission window.',
      'Nigeria; email submission',
      '₦350,000 first prize plus internship placement; ₦250,000 second prize; ₦200,000 third prize',
      'Writing, essay, journalism, and communication',
      '2026-11-22',
      null,
      null,
      'Prepare a 1,500–2,000-word essay on “Who Fails When Schools Fail? Practical Solutions to Nigeria’s Public Education Crisis” using Times New Roman, 12-point font, and 1.5 line spacing. Attach a copy of your valid school ID card and email the essay and ID card to ucjunibadan@gmail.com before 22 November 2026.',
      true,
      'Verified 2026-11-03 against the supplied ScholarshipAir listing https://www.scholarshipair.com/s/10277. The page identifies the contest as the Fisayo Soyombo Essay Contest for Undergraduates 2026, sponsored by the Union of Campus Journalists, and confirms Nigerian undergraduate eligibility, the essay topic, 1,500–2,000-word range, Times New Roman 12-point/1.5 spacing format, school-ID requirement, 22 November 2026 deadline, submission email ucjunibadan@gmail.com, prizes of ₦350,000 plus internship placement, ₦250,000, and ₦200,000. No stable HTTP application portal is provided, so application_url remains null and the email instructions are stored in how_to_apply.'
    ) returning id into v_opportunity_id;
  else
    update public.opportunities set
      type = 'competition',
      title = 'Fisayo Soyombo Essay Contest for Undergraduates 2026',
      provider_name = 'Union of Campus Journalists',
      description = 'An essay contest for undergraduate students at Nigerian universities examining Nigeria’s public education crisis ahead of the 2027 general elections.',
      eligibility_notes = 'Open to undergraduate university students in Nigeria. Applicants must write on “Who Fails When Schools Fail? Practical Solutions to Nigeria’s Public Education Crisis”, submit 1,500–2,000 words in Times New Roman 12-point font with 1.5 line spacing, and attach a valid school ID card.',
      duration = 'Online essay submission; winners are selected after the submission window.',
      location = 'Nigeria; email submission',
      compensation = '₦350,000 first prize plus internship placement; ₦250,000 second prize; ₦200,000 third prize',
      discipline = 'Writing, essay, journalism, and communication',
      deadline = '2026-11-22',
      opens_at = null,
      application_url = null,
      how_to_apply = 'Prepare a 1,500–2,000-word essay on “Who Fails When Schools Fail? Practical Solutions to Nigeria’s Public Education Crisis” using Times New Roman, 12-point font, and 1.5 line spacing. Attach a copy of your valid school ID card and email the essay and ID card to ucjunibadan@gmail.com before 22 November 2026.',
      verified = true,
      research_notes = 'Verified 2026-11-03 against the supplied ScholarshipAir listing https://www.scholarshipair.com/s/10277. The page identifies the contest as the Fisayo Soyombo Essay Contest for Undergraduates 2026, sponsored by the Union of Campus Journalists, and confirms Nigerian undergraduate eligibility, the essay topic, 1,500–2,000-word range, Times New Roman 12-point/1.5 spacing format, school-ID requirement, 22 November 2026 deadline, submission email ucjunibadan@gmail.com, prizes of ₦350,000 plus internship placement, ₦250,000, and ₦200,000. No stable HTTP application portal is provided, so application_url remains null and the email instructions are stored in how_to_apply.'
    where id = v_opportunity_id;
  end if;

  -- M. Kukoyi Foundation (MKF) Scholarship 2026.
  select id into v_scholarship_id
  from public.scholarships
  where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLSdBIS_G50LSI211HmPOXUFZG1UMtSgnzUZmpe47tVUuT4ufvQ/viewform'
     or lower(title) = lower('M. Kukoyi Foundation (MKF) Scholarship 2026')
  order by created_at desc
  limit 1;

  if v_scholarship_id is null then
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
      'M. Kukoyi Foundation (MKF) Scholarship 2026',
      'M. Kukoyi Foundation (MKF)',
      'A one-time tuition scholarship for undergraduate students in medicine and related health and medical science programmes at accredited institutions.',
      'Up to ₦300,000 one-time tuition award for one academic year; any tuition balance above ₦300,000 is the student’s responsibility.',
      '2026-11-22',
      'https://docs.google.com/forms/d/e/1FAIpQLSdBIS_G50LSI211HmPOXUFZG1UMtSgnzUZmpe47tVUuT4ufvQ/viewform',
      'undergrad',
      'Medicine, medical sciences, and health sciences',
      true,
      'Verified 2026-11-03 against the supplied ScholarshipAir listing https://www.scholarshipair.com/s/10287 and its linked Google Form https://docs.google.com/forms/d/e/1FAIpQLSdBIS_G50LSI211HmPOXUFZG1UMtSgnzUZmpe47tVUuT4ufvQ/viewform. The listing confirms that the scholarship is for students currently in second year or above in an eligible programme at an accredited institution, covers tuition for one academic year only, is capped at ₦300,000, is not automatically renewable, and closes on 22 November 2026. The linked form is reachable but requires Google sign-in during verification; no personal data was entered or submitted.',
      'Confirm that you are in your second year or above of an eligible medicine or related health/medical science programme at an accredited institution. Prepare accurate information and supporting documents for verification, then submit through the linked M. Kukoyi Foundation Google Form before 22 November 2026. The one-time award covers tuition for one academic year and is capped at ₦300,000.',
      now()
    ) returning id into v_scholarship_id;
  else
    update public.scholarships set
      title = 'M. Kukoyi Foundation (MKF) Scholarship 2026',
      provider_name = 'M. Kukoyi Foundation (MKF)',
      description = 'A one-time tuition scholarship for undergraduate students in medicine and related health and medical science programmes at accredited institutions.',
      amount = 'Up to ₦300,000 one-time tuition award for one academic year; any tuition balance above ₦300,000 is the student’s responsibility.',
      deadline = '2026-11-22',
      application_url = 'https://docs.google.com/forms/d/e/1FAIpQLSdBIS_G50LSI211HmPOXUFZG1UMtSgnzUZmpe47tVUuT4ufvQ/viewform',
      level = 'undergrad',
      discipline = 'Medicine, medical sciences, and health sciences',
      verified = true,
      research_notes = 'Verified 2026-11-03 against the supplied ScholarshipAir listing https://www.scholarshipair.com/s/10287 and its linked Google Form https://docs.google.com/forms/d/e/1FAIpQLSdBIS_G50LSI211HmPOXUFZG1UMtSgnzUZmpe47tVUuT4ufvQ/viewform. The listing confirms that the scholarship is for students currently in second year or above in an eligible programme at an accredited institution, covers tuition for one academic year only, is capped at ₦300,000, is not automatically renewable, and closes on 22 November 2026. The linked form is reachable but requires Google sign-in during verification; no personal data was entered or submitted.',
      how_to_apply = 'Confirm that you are in your second year or above of an eligible medicine or related health/medical science programme at an accredited institution. Prepare accurate information and supporting documents for verification, then submit through the linked M. Kukoyi Foundation Google Form before 22 November 2026. The one-time award covers tuition for one academic year and is capped at ₦300,000.',
      last_verified_at = now()
    where id = v_scholarship_id;
  end if;
end
$migration$;
