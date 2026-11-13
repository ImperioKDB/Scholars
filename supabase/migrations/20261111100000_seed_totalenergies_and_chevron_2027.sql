-- Verified 2026-11-11 against the official provider pages supplied by the user.
-- The TotalEnergies homepage links to two distinct scholarship schemes; both are
-- catalogued separately. The Google Form supplied alongside these links requires
-- Google sign-in and is intentionally not published without a verifiable title or
-- eligibility/deadline details.
do $migration$
declare
  v_id uuid;
begin
  -- NNPC Limited / TotalEnergies National Merit Scholarship Scheme 2026/2027.
  select id into v_id
  from public.scholarships
  where application_url = 'https://csr-ngscholarship.totalenergies.com/scholarships/nmss'
     or lower(title) = lower('NNPC Limited / TotalEnergies National Merit Scholarship Scheme 2026/2027')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply, opens_at,
      last_verified_at
    ) values (
      'NNPC Limited / TotalEnergies National Merit Scholarship Scheme 2026/2027',
      'NNPC Limited and TotalEnergies Upstream Nigeria Limited',
      'An annual undergraduate scholarship grant for eligible Nigerian students in their first or second year of full-time study at a NUC-accredited Nigerian university.',
      'An annual scholarship grant from the year of award through completion of the undergraduate programme.',
      '2026-12-07',
      'https://csr-ngscholarship.totalenergies.com/scholarships/nmss',
      'undergrad',
      null,
      true,
      'Verified 2026-11-11 against the supplied official TotalEnergies scholarship portal https://csr-ngscholarship.totalenergies.com/ and the official NMSS programme page https://csr-ngscholarship.totalenergies.com/scholarships/nmss. The official page states that the scheme supports first-year and second-year full-time Nigerian undergraduates at NUC-accredited Nigerian universities, requires a UTME score of at least 200, and requires 200-level applicants to have at least 2.5 CGPA on a 5.0 scale. The official portal search listing shows the 2026/2027 cycle opened 10 November 2026 and closes 7 December 2026. The scheme is free to apply for; TotalEnergies warns that it does not solicit money or accredit agents.',
      'Review the eligibility requirements and submit the online application through the official NMSS programme page before 7 December 2026. Applicants should prepare the supporting documents requested in the live application flow. Do not pay anyone to apply or to provide access to the scholarship.',
      '2026-11-10',
      now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'NNPC Limited / TotalEnergies National Merit Scholarship Scheme 2026/2027',
      provider_name = 'NNPC Limited and TotalEnergies Upstream Nigeria Limited',
      description = 'An annual undergraduate scholarship grant for eligible Nigerian students in their first or second year of full-time study at a NUC-accredited Nigerian university.',
      amount = 'An annual scholarship grant from the year of award through completion of the undergraduate programme.',
      deadline = '2026-12-07',
      application_url = 'https://csr-ngscholarship.totalenergies.com/scholarships/nmss',
      level = 'undergrad',
      discipline = null,
      verified = true,
      research_notes = 'Verified 2026-11-11 against the supplied official TotalEnergies scholarship portal https://csr-ngscholarship.totalenergies.com/ and the official NMSS programme page https://csr-ngscholarship.totalenergies.com/scholarships/nmss. The official page states that the scheme supports first-year and second-year full-time Nigerian undergraduates at NUC-accredited Nigerian universities, requires a UTME score of at least 200, and requires 200-level applicants to have at least 2.5 CGPA on a 5.0 scale. The official portal search listing shows the 2026/2027 cycle opened 10 November 2026 and closes 7 December 2026. The scheme is free to apply for; TotalEnergies warns that it does not solicit money or accredit agents.',
      how_to_apply = 'Review the eligibility requirements and submit the online application through the official NMSS programme page before 7 December 2026. Applicants should prepare the supporting documents requested in the live application flow. Do not pay anyone to apply or to provide access to the scholarship.',
      opens_at = '2026-11-10',
      last_verified_at = now()
    where id = v_id;
  end if;

  -- NNPC Limited / TotalEnergies International Scholarship.
  select id into v_id
  from public.scholarships
  where application_url = 'https://csr-ngscholarship.totalenergies.com/scholarships/tis'
     or lower(title) = lower('NNPC Limited / TotalEnergies International Scholarship')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply, opens_at,
      last_verified_at
    ) values (
      'NNPC Limited / TotalEnergies International Scholarship',
      'NNPC Limited and TotalEnergies Upstream Nigeria Limited',
      'A postgraduate scholarship for young Nigerian scholars pursuing master’s degree programmes at universities in France in Management Science, Engineering, or Geosciences.',
      'Full-board scholarship.',
      null,
      'https://csr-ngscholarship.totalenergies.com/scholarships/tis',
      'postgrad',
      'Management Science, Engineering, and Geosciences',
      true,
      'Verified 2026-11-11 against the supplied official TotalEnergies scholarship portal https://csr-ngscholarship.totalenergies.com/ and the official TIS programme page https://csr-ngscholarship.totalenergies.com/scholarships/tis. The official page confirms master’s study in France, a full-board scholarship, a university degree with at least Second Class Upper obtained no earlier than five years ago, and completion of the mandatory NYSC scheme. The fetched official programme page did not publish a closing date, so deadline is intentionally left blank rather than inferred.',
      'Review the official TIS eligibility requirements and submit through the TotalEnergies scholarship website when the application flow is open. Prepare proof of degree classification, graduation date, NYSC completion, and the supporting documents requested by the live application guide. Confirm the current closing date on the official portal before applying.',
      null,
      now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'NNPC Limited / TotalEnergies International Scholarship',
      provider_name = 'NNPC Limited and TotalEnergies Upstream Nigeria Limited',
      description = 'A postgraduate scholarship for young Nigerian scholars pursuing master’s degree programmes at universities in France in Management Science, Engineering, or Geosciences.',
      amount = 'Full-board scholarship.',
      deadline = null,
      application_url = 'https://csr-ngscholarship.totalenergies.com/scholarships/tis',
      level = 'postgrad',
      discipline = 'Management Science, Engineering, and Geosciences',
      verified = true,
      research_notes = 'Verified 2026-11-11 against the supplied official TotalEnergies scholarship portal https://csr-ngscholarship.totalenergies.com/ and the official TIS programme page https://csr-ngscholarship.totalenergies.com/scholarships/tis. The official page confirms master’s study in France, a full-board scholarship, a university degree with at least Second Class Upper obtained no earlier than five years ago, and completion of the mandatory NYSC scheme. The fetched official programme page did not publish a closing date, so deadline is intentionally left blank rather than inferred.',
      how_to_apply = 'Review the official TIS eligibility requirements and submit through the TotalEnergies scholarship website when the application flow is open. Prepare proof of degree classification, graduation date, NYSC completion, and the supporting documents requested by the live application guide. Confirm the current closing date on the official portal before applying.',
      opens_at = null,
      last_verified_at = now()
    where id = v_id;
  end if;

  -- Chevron Nigeria Limited NMA Undergraduate Internship - Jan 2027.
  select id into v_id
  from public.opportunities
  where application_url = 'https://careers.chevron.com/job/lekki/nma-undergraduate-internship-jan-2027/38138/103152674816'
     or lower(title) = lower('NMA Undergraduate Internship - Jan 2027')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'internship',
      'NMA Undergraduate Internship - Jan 2027',
      'Chevron Nigeria Limited',
      'A Chevron Nigeria Limited internship supporting the Student Industrial Work Experience Scheme (SIWES) through practical assignments, technical learning, mentorship, and professional workplace exposure.',
      'Open only to Nigerian students studying in Nigeria or abroad who can begin between February and March 2027. Applicants must be enrolled in a Bachelor’s, National Diploma, or Higher National Diploma programme and must need industrial experience as a compulsory part of completing the programme. A completed and signed SIWES recommendation letter is required.',
      'Minimum three months and maximum twelve months, as applicable.',
      'Lekki, Lagos',
      'Not stated on the official listing.',
      'Engineering, technology, business, and other disciplines aligned with the applicant’s academic programme and SIWES requirement',
      '2026-12-01',
      null,
      'https://careers.chevron.com/job/lekki/nma-undergraduate-internship-jan-2027/38138/103152674816',
      'Prepare a duly completed and signed SIWES recommendation letter from your institution and apply through the official Chevron careers listing before 1 December 2026 at 11:59 p.m. Chevron states that selection includes shortlisting and aptitude tests. Chevron does not charge applicants fees.',
      true,
      'Verified 2026-11-11 against the official Chevron Nigeria Limited job listing https://careers.chevron.com/job/lekki/nma-undergraduate-internship-jan-2027/38138/103152674816 and Chevron’s official internship overview https://careers.chevron.com/internship. The job page confirms the Nigerian-student eligibility, February–March 2027 start window, Bachelor’s/ND/HND requirement, compulsory industrial-experience requirement, SIWES recommendation letter, three-to-twelve-month duration, Lekki location, online application route, selection process, and closing time of 1 December 2026 at 11:59 p.m. Chevron also warns that it never seeks fees from job applicants.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'internship',
      title = 'NMA Undergraduate Internship - Jan 2027',
      provider_name = 'Chevron Nigeria Limited',
      description = 'A Chevron Nigeria Limited internship supporting the Student Industrial Work Experience Scheme (SIWES) through practical assignments, technical learning, mentorship, and professional workplace exposure.',
      eligibility_notes = 'Open only to Nigerian students studying in Nigeria or abroad who can begin between February and March 2027. Applicants must be enrolled in a Bachelor’s, National Diploma, or Higher National Diploma programme and must need industrial experience as a compulsory part of completing the programme. A completed and signed SIWES recommendation letter is required.',
      duration = 'Minimum three months and maximum twelve months, as applicable.',
      location = 'Lekki, Lagos',
      compensation = 'Not stated on the official listing.',
      discipline = 'Engineering, technology, business, and other disciplines aligned with the applicant’s academic programme and SIWES requirement',
      deadline = '2026-12-01',
      opens_at = null,
      application_url = 'https://careers.chevron.com/job/lekki/nma-undergraduate-internship-jan-2027/38138/103152674816',
      how_to_apply = 'Prepare a duly completed and signed SIWES recommendation letter from your institution and apply through the official Chevron careers listing before 1 December 2026 at 11:59 p.m. Chevron states that selection includes shortlisting and aptitude tests. Chevron does not charge applicants fees.',
      verified = true,
      research_notes = 'Verified 2026-11-11 against the official Chevron Nigeria Limited job listing https://careers.chevron.com/job/lekki/nma-undergraduate-internship-jan-2027/38138/103152674816 and Chevron’s official internship overview https://careers.chevron.com/internship. The job page confirms the Nigerian-student eligibility, February–March 2027 start window, Bachelor’s/ND/HND requirement, compulsory industrial-experience requirement, SIWES recommendation letter, three-to-twelve-month duration, Lekki location, online application route, selection process, and closing time of 1 December 2026 at 11:59 p.m. Chevron also warns that it never seeks fees from job applicants.'
    where id = v_id;
  end if;
end
$migration$;
