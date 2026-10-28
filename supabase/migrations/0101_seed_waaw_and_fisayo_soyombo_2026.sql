-- Publish the verified WAAW Foundation Scholarship and Fisayo Soyombo
-- Inter-Varsity Essay Competition 2026 supplied by the user.
-- WAAW is a scholarship; Fisayo Soyombo is an essay competition and belongs
-- in public.opportunities. The records are keyed by canonical source URL/title
-- so reapplying this migration updates rather than duplicates them.
do $migration$
declare
  v_scholarship_id uuid;
  v_opportunity_id uuid;
begin
  -- WAAW Foundation Scholarship 2026/2027.
  select id into v_scholarship_id
  from public.scholarships
  where application_url = 'https://waawfoundation.org/scholarship/'
     or lower(title) = lower('WAAW Foundation Scholarship 2026/2027')
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
      opens_at,
      last_verified_at
    ) values (
      'WAAW Foundation Scholarship 2026/2027',
      'WAAW Foundation',
      'A one-time scholarship for female African students enrolled in undergraduate STEM programmes at universities or colleges in Africa. Applicants must demonstrate financial need, strong academic performance, leadership or community service, and be under 32.',
      'US$500 one-time award',
      null,
      'https://waawfoundation.org/scholarship/',
      'undergrad',
      'STEM',
      true,
      'Verified 2026-10-28 against the official WAAW Foundation scholarship page https://waawfoundation.org/scholarship/. The official page states that applications open 30 October 2026; the page does not publish a closing date. It states that applicants must be female students of African origin living and studying in Africa, enrolled in an undergraduate STEM-related course, in first or second year (or third year of a five-year course), able to demonstrate financial need, academically strong, involved in leadership/volunteering/community service, and under 32. The official FAQ states that the award is a one-time US$500 scholarship and that medical and nursing students are not eligible, while pharmacy students are eligible. No unsupported deadline or nationality rule is added.',
      'Review the eligibility information on the official WAAW Foundation page and complete the online application when applications open on 30 October 2026. Prepare two reference letters (one from a professor and one from an academic supervisor, adviser, or mentor), a scanned school ID card, and a signed and sealed current transcript for the second-stage review.',
      '2026-10-30',
      now()
    ) returning id into v_scholarship_id;
  else
    update public.scholarships set
      title = 'WAAW Foundation Scholarship 2026/2027',
      provider_name = 'WAAW Foundation',
      description = 'A one-time scholarship for female African students enrolled in undergraduate STEM programmes at universities or colleges in Africa. Applicants must demonstrate financial need, strong academic performance, leadership or community service, and be under 32.',
      amount = 'US$500 one-time award',
      deadline = null,
      application_url = 'https://waawfoundation.org/scholarship/',
      level = 'undergrad',
      discipline = 'STEM',
      verified = true,
      research_notes = 'Verified 2026-10-28 against the official WAAW Foundation scholarship page https://waawfoundation.org/scholarship/. The official page states that applications open 30 October 2026; the page does not publish a closing date. It states that applicants must be female students of African origin living and studying in Africa, enrolled in an undergraduate STEM-related course, in first or second year (or third year of a five-year course), able to demonstrate financial need, academically strong, involved in leadership/volunteering/community service, and under 32. The official FAQ states that the award is a one-time US$500 scholarship and that medical and nursing students are not eligible, while pharmacy students are eligible. No unsupported deadline or nationality rule is added.',
      how_to_apply = 'Review the eligibility information on the official WAAW Foundation page and complete the online application when applications open on 30 October 2026. Prepare two reference letters (one from a professor and one from an academic supervisor, adviser, or mentor), a scanned school ID card, and a signed and sealed current transcript for the second-stage review.',
      opens_at = '2026-10-30',
      last_verified_at = now()
    where id = v_scholarship_id;
  end if;

  -- Fisayo Soyombo Inter-Varsity Essay Competition 2026.
  select id into v_opportunity_id
  from public.opportunities
  where application_url is null
    and (lower(title) = lower('Fisayo Soyombo Inter-Varsity Essay Competition 2026')
      or lower(title) = lower('9th Annual Fisayo Soyombo Inter-Varsity Essay Competition'))
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
      'Fisayo Soyombo Inter-Varsity Essay Competition 2026',
      'Union of Campus Journalists, University of Ibadan',
      'The 9th annual inter-university essay competition invites Nigerian undergraduates to examine the relationship between elections and democracy as the country approaches the 2027 general elections.',
      'Open to undergraduate university students studying in Nigeria. Entrants must write on “2027 and Beyond: Do Elections Still Deliver Democracy for Nigerians?”, submit 1,500–2,000 words in Times New Roman 12-point font with 1.5 line spacing, and attach a readable copy of their school identity card.',
      'Online essay submission; winners are selected after the submission window.',
      'Nigeria; online submission',
      '₦400,000 first prize; ₦300,000 second prize; ₦200,000 third prize',
      'Writing, essay, journalism, and communication',
      '2026-11-22',
      null,
      null,
      'Prepare a 1,500–2,000-word essay on “2027 and Beyond: Do Elections Still Deliver Democracy for Nigerians?” using Times New Roman, 12-point font, and 1.5 line spacing. Attach a copy of your school ID card and email the essay and ID card to ucjunibadan@gmail.com before 22 November 2026.',
      true,
      'Verified 2026-10-28 against the supplied Icanstudent page https://www.icanstudent.com/fisayo-soyombo-inter-varsity-essay-competition-2026/. The listing identifies the 9th annual competition, its organiser (Union of Campus Journalists, University of Ibadan), Nigerian undergraduate eligibility, the official essay topic, 1,500–2,000-word range, Times New Roman 12-point/1.5 spacing format, school-ID requirement, 22 November 2026 deadline, submission email ucjunibadan@gmail.com, and prizes of ₦400,000/₦300,000/₦200,000. The page does not provide a stable HTTP application portal, so application_url remains null and the email instructions are stored in how_to_apply.'
    ) returning id into v_opportunity_id;
  else
    update public.opportunities set
      type = 'competition',
      title = 'Fisayo Soyombo Inter-Varsity Essay Competition 2026',
      provider_name = 'Union of Campus Journalists, University of Ibadan',
      description = 'The 9th annual inter-university essay competition invites Nigerian undergraduates to examine the relationship between elections and democracy as the country approaches the 2027 general elections.',
      eligibility_notes = 'Open to undergraduate university students studying in Nigeria. Entrants must write on “2027 and Beyond: Do Elections Still Deliver Democracy for Nigerians?”, submit 1,500–2,000 words in Times New Roman 12-point font with 1.5 line spacing, and attach a readable copy of their school identity card.',
      duration = 'Online essay submission; winners are selected after the submission window.',
      location = 'Nigeria; online submission',
      compensation = '₦400,000 first prize; ₦300,000 second prize; ₦200,000 third prize',
      discipline = 'Writing, essay, journalism, and communication',
      deadline = '2026-11-22',
      opens_at = null,
      application_url = null,
      how_to_apply = 'Prepare a 1,500–2,000-word essay on “2027 and Beyond: Do Elections Still Deliver Democracy for Nigerians?” using Times New Roman, 12-point font, and 1.5 line spacing. Attach a copy of your school ID card and email the essay and ID card to ucjunibadan@gmail.com before 22 November 2026.',
      verified = true,
      research_notes = 'Verified 2026-10-28 against the supplied Icanstudent page https://www.icanstudent.com/fisayo-soyombo-inter-varsity-essay-competition-2026/. The listing identifies the 9th annual competition, its organiser (Union of Campus Journalists, University of Ibadan), Nigerian undergraduate eligibility, the official essay topic, 1,500–2,000-word range, Times New Roman 12-point/1.5 spacing format, school-ID requirement, 22 November 2026 deadline, submission email ucjunibadan@gmail.com, and prizes of ₦400,000/₦300,000/₦200,000. The page does not provide a stable HTTP application portal, so application_url remains null and the email instructions are stored in how_to_apply.'
    where id = v_opportunity_id;
  end if;
end
$migration$;
