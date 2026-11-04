-- Publish the three user-supplied opportunities after source verification.
-- UNHCR is a rolling internship programme, Kectil is a 2027 leadership
-- programme, and the UN Women x Women in Tech record is limited to what its
-- public registration form actually states.
do $migration$
declare
  v_id uuid;
begin
  -- UNHCR Internship Programme.
  select id into v_id
  from public.opportunities
  where application_url = 'https://unhcr.wd3.myworkdayjobs.com/External'
     or lower(title) = lower('UNHCR Internship Programme')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'internship',
      'UNHCR Internship Programme',
      'UNHCR, the UN Refugee Agency',
      'A practical work-experience programme for eligible students and recent graduates seeking experience in the humanitarian sector in line with their academic programme and career aspirations.',
      'Applicants must be current students in an undergraduate or graduate programme or recent graduates who completed their studies within two years of applying, at a university or higher-education facility accredited by UNESCO. Applicants must have completed at least two years of undergraduate study in a relevant or related field, meet UNHCR conflict-of-interest restrictions, remain within the cumulative internship maximum, and have English proficiency at minimum B2 level. Internships are open to all nationalities.',
      'Normally 2–6 months, with possible extension up to 8 months full-time or 12 months part-time, including prior UNHCR internships.',
      'Various UNHCR locations, including Geneva headquarters, global service centres, and field country offices; some internships may be approved for telework.',
      'Interns without outside financial support receive an allowance to partially support food, local transportation, and living costs. Remote internships are also compensated. UNHCR may reimburse eligible return travel to and from the duty station when not provided by a sponsor. Interns are responsible for medical insurance and visa costs.',
      'Humanitarian affairs, refugee studies, international development, public policy, law, communications, and other fields relevant to UNHCR work',
      null,
      null,
      'https://unhcr.wd3.myworkdayjobs.com/External',
      'Search current internship vacancies on the UNHCR recruitment platform at https://unhcr.wd3.myworkdayjobs.com/External and apply through the individual vacancy. UNHCR states that it does not charge a fee at any stage of recruitment. Review the official internship page and UNHCR application guidance before applying.',
      true,
      'Verified 2026-11-04 against the supplied official UNHCR internship page https://www.unhcr.org/get-involved/work-us/careers-unhcr/types-contracts-and-appointments/internships. The page confirms the student/recent-graduate eligibility rules, two-year study requirement, UNESCO-accredited institution requirement, English B2 minimum, nationality openness, 2–6 month normal duration, cumulative 8-month full-time/12-month part-time maximum, allowance and travel-cost provisions, medical-insurance responsibility, and application through the UNHCR Workday recruitment platform. The page describes a rolling programme whose placements begin at any time based on office needs; no single programme deadline is published.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'internship',
      title = 'UNHCR Internship Programme',
      provider_name = 'UNHCR, the UN Refugee Agency',
      description = 'A practical work-experience programme for eligible students and recent graduates seeking experience in the humanitarian sector in line with their academic programme and career aspirations.',
      eligibility_notes = 'Applicants must be current students in an undergraduate or graduate programme or recent graduates who completed their studies within two years of applying, at a university or higher-education facility accredited by UNESCO. Applicants must have completed at least two years of undergraduate study in a relevant or related field, meet UNHCR conflict-of-interest restrictions, remain within the cumulative internship maximum, and have English proficiency at minimum B2 level. Internships are open to all nationalities.',
      duration = 'Normally 2–6 months, with possible extension up to 8 months full-time or 12 months part-time, including prior UNHCR internships.',
      location = 'Various UNHCR locations, including Geneva headquarters, global service centres, and field country offices; some internships may be approved for telework.',
      compensation = 'Interns without outside financial support receive an allowance to partially support food, local transportation, and living costs. Remote internships are also compensated. UNHCR may reimburse eligible return travel to and from the duty station when not provided by a sponsor. Interns are responsible for medical insurance and visa costs.',
      discipline = 'Humanitarian affairs, refugee studies, international development, public policy, law, communications, and other fields relevant to UNHCR work',
      deadline = null,
      opens_at = null,
      application_url = 'https://unhcr.wd3.myworkdayjobs.com/External',
      how_to_apply = 'Search current internship vacancies on the UNHCR recruitment platform at https://unhcr.wd3.myworkdayjobs.com/External and apply through the individual vacancy. UNHCR states that it does not charge a fee at any stage of recruitment. Review the official internship page and UNHCR application guidance before applying.',
      verified = true,
      research_notes = 'Verified 2026-11-04 against the supplied official UNHCR internship page https://www.unhcr.org/get-involved/work-us/careers-unhcr/types-contracts-and-appointments/internships. The page confirms the student/recent-graduate eligibility rules, two-year study requirement, UNESCO-accredited institution requirement, English B2 minimum, nationality openness, 2–6 month normal duration, cumulative 8-month full-time/12-month part-time maximum, allowance and travel-cost provisions, medical-insurance responsibility, and application through the UNHCR Workday recruitment platform. The page describes a rolling programme whose placements begin at any time based on office needs; no single programme deadline is published.'
    where id = v_id;
  end if;

  -- Kectil Program 2027.
  select id into v_id
  from public.opportunities
  where application_url = 'https://kectil.com/apply'
     or lower(title) = lower('Kectil Program 2027')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'training',
      'Kectil Program 2027',
      'Malmar Knowles Family Foundation',
      'A one-year global leadership programme for young people in developing countries focused on authentic leadership, good governance, community impact, and practical skills for ethical social change.',
      'Designed for youth leaders ages 17–26 living in developing countries. The official programme page also identifies English and internet access among the application criteria. The application form says applicants outside the primary age range may still be reviewed, but the programme is designed primarily for ages 17–26.',
      'One year, with a confidential online learning portal, assignments, discussions, community projects, networking, and certificates and awards. Graduates may join the Kectil Alumni Network.',
      'Global; applicants must live in a developing country. The programme is delivered primarily online with wider conferences, regional chapters, and community activities.',
      'The 2027 programme is provided free to accepted applicants. It is not described as a cash scholarship. High-performing participants may earn certificates, regional-coordinator opportunities, or direct mentorship pairings.',
      'Leadership, governance, entrepreneurship, social innovation, community development, peace, mental health, and personal finance',
      '2026-11-15',
      null,
      'https://kectil.com/apply',
      'Complete the official Kectil 2027 application at https://kectil.com/apply before 15 November 2026. The form collects personal, education, parent, and applicant-background information. Applicants can use the simple application route or resume a saved application through the official portal.',
      true,
      'Verified 2026-11-04 against the official Kectil homepage https://kectil.com/, programme page https://kectil.com/program, and 2027 application page https://kectil.com/apply. The official pages confirm the 2027 cycle, 17–26 target age range, developing-country focus, 15 November 2026 closing date, one-year structure, free participation for accepted applicants, leadership and community-impact curriculum, online portal, community projects, certificates/awards, and alumni network. The application form states that applicants outside the primary age range may still be reviewed; this is preserved as a form caveat rather than converted into a hard rule.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'training',
      title = 'Kectil Program 2027',
      provider_name = 'Malmar Knowles Family Foundation',
      description = 'A one-year global leadership programme for young people in developing countries focused on authentic leadership, good governance, community impact, and practical skills for ethical social change.',
      eligibility_notes = 'Designed for youth leaders ages 17–26 living in developing countries. The official programme page also identifies English and internet access among the application criteria. The application form says applicants outside the primary age range may still be reviewed, but the programme is designed primarily for ages 17–26.',
      duration = 'One year, with a confidential online learning portal, assignments, discussions, community projects, networking, and certificates and awards. Graduates may join the Kectil Alumni Network.',
      location = 'Global; applicants must live in a developing country. The programme is delivered primarily online with wider conferences, regional chapters, and community activities.',
      compensation = 'The 2027 programme is provided free to accepted applicants. It is not described as a cash scholarship. High-performing participants may earn certificates, regional-coordinator opportunities, or direct mentorship pairings.',
      discipline = 'Leadership, governance, entrepreneurship, social innovation, community development, peace, mental health, and personal finance',
      deadline = '2026-11-15',
      opens_at = null,
      application_url = 'https://kectil.com/apply',
      how_to_apply = 'Complete the official Kectil 2027 application at https://kectil.com/apply before 15 November 2026. The form collects personal, education, parent, and applicant-background information. Applicants can use the simple application route or resume a saved application through the official portal.',
      verified = true,
      research_notes = 'Verified 2026-11-04 against the official Kectil homepage https://kectil.com/, programme page https://kectil.com/program, and 2027 application page https://kectil.com/apply. The official pages confirm the 2027 cycle, 17–26 target age range, developing-country focus, 15 November 2026 closing date, one-year structure, free participation for accepted applicants, leadership and community-impact curriculum, online portal, community projects, certificates/awards, and alumni network. The application form states that applicants outside the primary age range may still be reviewed; this is preserved as a form caveat rather than converted into a hard rule.'
    where id = v_id;
  end if;

  -- UN Women x Women in Tech Global programme registration.
  select id into v_id
  from public.opportunities
  where application_url = 'https://women-in-tech.typeform.com/UNWIT'
     or lower(title) = lower('UN Women x Women in Tech Global Programme Registration')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'training',
      'UN Women x Women in Tech Global Programme Registration',
      'UN Women and Women in Tech Global',
      'A public registration form for a programme associated with UN Women and Women in Tech Global. The form asks about applicants’ age, location, language, education, employment, connectivity, access to services, and care responsibilities so the organisers can understand participants and their participation needs.',
      'The public form does not state a complete eligibility rule, target country list, selection process, or age cutoff. Applicants should review the form and any organiser communication for the current programme-specific requirements before submitting.',
      null,
      null,
      'Not stated on the public registration form. No cash award, stipend, or funded benefit is asserted.',
      'Women in technology, digital inclusion, education, employment, and gender equality',
      null,
      null,
      'https://women-in-tech.typeform.com/UNWIT',
      'Review and complete the public registration form at https://women-in-tech.typeform.com/UNWIT. Do not assume that registration guarantees admission, funding, training, or another award because those terms are not published on the form page.',
      true,
      'Verified 2026-11-04 against the supplied Typeform https://women-in-tech.typeform.com/UNWIT and Women in Tech Global’s official website https://women-in-tech.org/. The Typeform is public, titled “UN Women x Women in Tech® Global,” and its welcome screen says it is used to register for a programme. The public form was published 2026-10-15 and updated 2026-10-19; its questions cover age, residence, language, education, employment, internet/device access, health and training access, household responsibilities, and care needs. The public form does not state a deadline, duration, location, benefit package, complete eligibility criteria, or selection process, so those fields are intentionally left null or qualified. No form response was submitted and no personal data was entered.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'training',
      title = 'UN Women x Women in Tech Global Programme Registration',
      provider_name = 'UN Women and Women in Tech Global',
      description = 'A public registration form for a programme associated with UN Women and Women in Tech Global. The form asks about applicants’ age, location, language, education, employment, connectivity, access to services, and care responsibilities so the organisers can understand participants and their participation needs.',
      eligibility_notes = 'The public form does not state a complete eligibility rule, target country list, selection process, or age cutoff. Applicants should review the form and any organiser communication for the current programme-specific requirements before submitting.',
      duration = null,
      location = null,
      compensation = 'Not stated on the public registration form. No cash award, stipend, or funded benefit is asserted.',
      discipline = 'Women in technology, digital inclusion, education, employment, and gender equality',
      deadline = null,
      opens_at = null,
      application_url = 'https://women-in-tech.typeform.com/UNWIT',
      how_to_apply = 'Review and complete the public registration form at https://women-in-tech.typeform.com/UNWIT. Do not assume that registration guarantees admission, funding, training, or another award because those terms are not published on the form page.',
      verified = true,
      research_notes = 'Verified 2026-11-04 against the supplied Typeform https://women-in-tech.typeform.com/UNWIT and Women in Tech Global’s official website https://women-in-tech.org/. The Typeform is public, titled “UN Women x Women in Tech® Global,” and its welcome screen says it is used to register for a programme. The public form was published 2026-10-15 and updated 2026-10-19; its questions cover age, residence, language, education, employment, internet/device access, health and training access, household responsibilities, and care needs. The public form does not state a deadline, duration, location, benefit package, complete eligibility criteria, or selection process, so those fields are intentionally left null or qualified. No form response was submitted and no personal data was entered.'
    where id = v_id;
  end if;
end
$migration$;
