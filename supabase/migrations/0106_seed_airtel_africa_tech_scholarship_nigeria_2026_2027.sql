-- Publish the Airtel Africa Foundation Undergraduate Tech Scholarship
-- 2026/2027 for Nigerian students.
-- The official Foundation page confirms the programme and scholarship benefits.
-- The supplied 2026/2027 flyer supplies the Nigerian cycle deadline and
-- expanded university list; its short application link was unavailable when
-- verified, so the record preserves that caveat rather than hiding it.
do $migration$
declare
  v_id uuid;
begin
  select id into v_id
  from public.opportunities
  where lower(title) = lower('Airtel Africa Foundation Undergraduate Tech Scholarship 2026/2027 - Nigeria')
     or application_url = 'https://www.airtelafricafoundation.org/airtel-africa-tech'
  order by created_at desc
  limit 1;

  if v_id is null then
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
      'scholarship',
      'Airtel Africa Foundation Undergraduate Tech Scholarship 2026/2027 - Nigeria',
      'Airtel Africa Foundation',
      'An undergraduate technology scholarship supporting Nigerian students pursuing technology, science, engineering, and other ICT-related degrees at participating public universities. The Airtel Africa Foundation describes the wider Airtel Africa Tech Fellowship as a full scholarship programme that also supports career readiness, mentorship, internships, and early-career pathways.',
      'For Nigerian undergraduates in participating public universities and technology-related fields. The 2026/2027 flyer lists University of Lagos (UNILAG), University of Nigeria, Nsukka (UNN), Ahmadu Bello University (ABU), University of Benin (UNIBEN), Obafemi Awolowo University (OAU), University of Ilorin (UNILORIN), Tai Solarin University of Education (TASUED), University of Abuja, University of Uyo (UNIUYO), Federal University of Technology, Owerri (FUTO), and University of Maiduguri (UNIMAID). Listed fields include Computer Science, Information Technology, Cybersecurity, Systems Engineering, Software Engineering, and other technology-related fields. Applicants should confirm the live call''s final eligibility and document requirements before applying.',
      'Support is intended for the duration of the undergraduate programme; the official Nigerian programme information describes 4–5 years for Bachelor of Technology, Science, and Engineering programmes.',
      'Nigeria; participating public universities listed in the 2026/2027 call',
      'The supplied 2026/2027 flyer lists tuition, stipends, mentorship, and essential study needs. The official Airtel Africa Foundation programme page further describes full undergraduate scholarship support covering tuition, accommodation, learning materials, a stipend, a laptop, and connectivity, together with career readiness, mentorship, internship pathways, and an alumni network. Exact Nigerian-cycle disbursement terms should be confirmed in the active call.',
      'Computer Science, Information Technology, Cybersecurity, Systems Engineering, Software Engineering, and other technology-related fields',
      '2026-12-07',
      null,
      'https://www.airtelafricafoundation.org/airtel-africa-tech',
      'Review the official Airtel Africa Foundation Tech Fellowship page at https://www.airtelafricafoundation.org/airtel-africa-tech and use the active Nigeria application route when the 2026/2027 call is live. The supplied flyer points to https://bit.ly/4y4xVUkc, but that short link returned 404 when checked on 5 November 2026. Airtel''s official page currently links to the Nigerian Scholastica portal, whose visible page is the closed 2025 cycle, so applicants should confirm the replacement 2026/2027 application link before submitting any documents or personal information.',
      true,
      'Verified 2026-11-05. The official Airtel Africa Foundation Tech Fellowship page at https://www.airtelafricafoundation.org/airtel-africa-tech states that the initiative offers full undergraduate scholarships in STEM-related fields and links a Nigeria application route. The official education page at https://www.airtelafricafoundation.org/education/airtel-africa-tech-fellowships describes support for tuition, accommodation, learning materials, stipend, laptop, connectivity, career readiness, mentorship, internship pathways, and an alumni network. The supplied flyer identifies the Nigerian 2026/2027 academic session, 7 December 2026 deadline, 11 participating universities, and listed eligible technology fields. Airtel Nigeria''s public LinkedIn announcement and the linked Scholastica portal corroborate the earlier Nigerian programme structure, but both show the 2025/2026 cycle and seven universities, while the portal now says applications have ended. The flyer short link https://bit.ly/4y4xVUkc returned HTTP 404 on verification. No application was submitted and no personal data was entered.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'scholarship',
      title = 'Airtel Africa Foundation Undergraduate Tech Scholarship 2026/2027 - Nigeria',
      provider_name = 'Airtel Africa Foundation',
      description = 'An undergraduate technology scholarship supporting Nigerian students pursuing technology, science, engineering, and other ICT-related degrees at participating public universities. The Airtel Africa Foundation describes the wider Airtel Africa Tech Fellowship as a full scholarship programme that also supports career readiness, mentorship, internships, and early-career pathways.',
      eligibility_notes = 'For Nigerian undergraduates in participating public universities and technology-related fields. The 2026/2027 flyer lists University of Lagos (UNILAG), University of Nigeria, Nsukka (UNN), Ahmadu Bello University (ABU), University of Benin (UNIBEN), Obafemi Awolowo University (OAU), University of Ilorin (UNILORIN), Tai Solarin University of Education (TASUED), University of Abuja, University of Uyo (UNIUYO), Federal University of Technology, Owerri (FUTO), and University of Maiduguri (UNIMAID). Listed fields include Computer Science, Information Technology, Cybersecurity, Systems Engineering, Software Engineering, and other technology-related fields. Applicants should confirm the live call''s final eligibility and document requirements before applying.',
      duration = 'Support is intended for the duration of the undergraduate programme; the official Nigerian programme information describes 4–5 years for Bachelor of Technology, Science, and Engineering programmes.',
      location = 'Nigeria; participating public universities listed in the 2026/2027 call',
      compensation = 'The supplied 2026/2027 flyer lists tuition, stipends, mentorship, and essential study needs. The official Airtel Africa Foundation programme page further describes full undergraduate scholarship support covering tuition, accommodation, learning materials, a stipend, a laptop, and connectivity, together with career readiness, mentorship, internship pathways, and an alumni network. Exact Nigerian-cycle disbursement terms should be confirmed in the active call.',
      discipline = 'Computer Science, Information Technology, Cybersecurity, Systems Engineering, Software Engineering, and other technology-related fields',
      deadline = '2026-12-07',
      opens_at = null,
      application_url = 'https://www.airtelafricafoundation.org/airtel-africa-tech',
      how_to_apply = 'Review the official Airtel Africa Foundation Tech Fellowship page at https://www.airtelafricafoundation.org/airtel-africa-tech and use the active Nigeria application route when the 2026/2027 call is live. The supplied flyer points to https://bit.ly/4y4xVUkc, but that short link returned 404 when checked on 5 November 2026. Airtel''s official page currently links to the Nigerian Scholastica portal, whose visible page is the closed 2025 cycle, so applicants should confirm the replacement 2026/2027 application link before submitting any documents or personal information.',
      verified = true,
      research_notes = 'Verified 2026-11-05. The official Airtel Africa Foundation Tech Fellowship page at https://www.airtelafricafoundation.org/airtel-africa-tech states that the initiative offers full undergraduate scholarships in STEM-related fields and links a Nigeria application route. The official education page at https://www.airtelafricafoundation.org/education/airtel-africa-tech-fellowships describes support for tuition, accommodation, learning materials, stipend, laptop, connectivity, career readiness, mentorship, internship pathways, and an alumni network. The supplied flyer identifies the Nigerian 2026/2027 academic session, 7 December 2026 deadline, 11 participating universities, and listed eligible technology fields. Airtel Nigeria''s public LinkedIn announcement and the linked Scholastica portal corroborate the earlier Nigerian programme structure, but both show the 2025/2026 cycle and seven universities, while the portal now says applications have ended. The flyer short link https://bit.ly/4y4xVUkc returned HTTP 404 on verification. No application was submitted and no personal data was entered.'
    where id = v_id;
  end if;
end
$migration$;
