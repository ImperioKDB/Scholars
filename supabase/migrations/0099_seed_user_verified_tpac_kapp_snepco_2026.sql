-- User-confirmed opportunities verified 2026-10-27.
-- TPA and KAPP are competitions; NNPC–SNEPCo is an undergraduate scholarship.
-- Records are upserted by canonical application URL or title to prevent duplicates.
do $migration$
declare
  v_scholarship_id uuid;
  v_tpa_id uuid;
  v_kapp_id uuid;
begin
  -- NNPC–SNEPCo National University Scholarship 2026.
  select id into v_scholarship_id
  from public.scholarships
  where application_url = 'https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26'
     or lower(title) = lower('NNPC - SNEPCo National University Scholarship 2026')
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
      'NNPC - SNEPCo National University Scholarship 2026',
      'NNPC Limited, Shell Nigeria Exploration and Production Company (SNEPCo), and co-venture partners',
      'A merit-based renewable scholarship for eligible Nigerian undergraduates studying in public NUC-accredited universities. Successful scholars receive an annual grant from their second year through completion of their undergraduate degree, subject to the programme conditions.',
      'Annual grant renewable through graduation; amount not published on the official scheme page',
      '2026-11-30',
      'https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26',
      'undergrad',
      null,
      true,
      'Verified 2026-10-27 using the supplied Scholastica campaign URL https://candidate.scholastica.ng/schemes/campaign/5171?utm_source=scholarsworld.ng and the current canonical Scholastica scheme URL https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26. The supplied campaign page contains the 2026 NNPC-SNEPCo programme details, a 30 November 2026 deadline, public-university and 200-level eligibility, a minimum 3.5 CGPA on a 5-point scale or equivalent, and the no-fee application warning. The canonical scheme URL is used for applications because the campaign URL displays a stale ended-cycle banner.',
      'Apply free through the canonical Scholastica scheme page before 30 November 2026. Applicants must be Nigerian citizens, full-time 200-level students in a public NUC-accredited Nigerian university, have at least a 3.5 CGPA on a 5-point scale or equivalent, and not hold another oil-and-gas scholarship. Prepare a passport photograph, admission or JAMB letter, UTME result, O-Level results, state-of-origin identification, and 100-level academic results. Only apply through Scholastica; do not pay an agent or intermediary.',
      now()
    ) returning id into v_scholarship_id;
  else
    update public.scholarships set
      title = 'NNPC - SNEPCo National University Scholarship 2026',
      provider_name = 'NNPC Limited, Shell Nigeria Exploration and Production Company (SNEPCo), and co-venture partners',
      description = 'A merit-based renewable scholarship for eligible Nigerian undergraduates studying in public NUC-accredited universities. Successful scholars receive an annual grant from their second year through completion of their undergraduate degree, subject to the programme conditions.',
      amount = 'Annual grant renewable through graduation; amount not published on the official scheme page',
      deadline = '2026-11-30',
      application_url = 'https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26',
      level = 'undergrad',
      discipline = null,
      verified = true,
      research_notes = 'Verified 2026-10-27 using the supplied Scholastica campaign URL https://candidate.scholastica.ng/schemes/campaign/5171?utm_source=scholarsworld.ng and the current canonical Scholastica scheme URL https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26. The supplied campaign page contains the 2026 NNPC-SNEPCo programme details, a 30 November 2026 deadline, public-university and 200-level eligibility, a minimum 3.5 CGPA on a 5-point scale or equivalent, and the no-fee application warning. The canonical scheme URL is used for applications because the campaign URL displays a stale ended-cycle banner.',
      how_to_apply = 'Apply free through the canonical Scholastica scheme page before 30 November 2026. Applicants must be Nigerian citizens, full-time 200-level students in a public NUC-accredited Nigerian university, have at least a 3.5 CGPA on a 5-point scale or equivalent, and not hold another oil-and-gas scholarship. Prepare a passport photograph, admission or JAMB letter, UTME result, O-Level results, state-of-origin identification, and 100-level academic results. Only apply through Scholastica; do not pay an agent or intermediary.',
      last_verified_at = now()
    where id = v_scholarship_id;
  end if;

  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_scholarship_id and field = 'nationality' and operator = 'eq' and value = '"Nigeria"'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_scholarship_id, 'nationality', 'eq', '"Nigeria"'::jsonb, true);
  end if;

  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_scholarship_id and field = 'year_of_study' and operator = 'eq' and value = '200'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_scholarship_id, 'year_of_study', 'eq', '200'::jsonb, true);
  end if;

  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_scholarship_id and field = 'gpa' and operator = 'gte' and value = '3.5'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_scholarship_id, 'gpa', 'gte', '3.5'::jsonb, true);
  end if;

  -- TPA Colloquium National Essay & Article Competition 2026.
  select id into v_tpa_id
  from public.opportunities
  where application_url = 'https://forms.gle/NHx8nTw5CuRG7u6EA'
     or lower(title) = lower('TPA Colloquium National Essay & Article Competition 2026')
  order by created_at desc
  limit 1;

  if v_tpa_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'competition',
      'TPA Colloquium National Essay & Article Competition 2026',
      'TPA Colloquium',
      'A national essay and article competition on the Brand Nigeria conversation, with separate postgraduate, undergraduate, and secondary-school categories.',
      'Open to Nigerians in postgraduate, undergraduate, and secondary-school categories. The undergraduate topic is “The Brand Nigeria: From Potential to Global Recognition — How Can Education, Entrepreneurship, Technology, and Creativity Help Strengthen Nigeria''s Global Brand?”',
      'Submission window: 1 October–30 October 2026. Undergraduate and postgraduate entries must be 2,500–3,000 words; secondary-school entries must be 1,000–1,500 words.',
      'Nigeria; online submission',
      'Postgraduate ₦1,000,000; undergraduate ₦750,000; secondary school ₦500,000',
      'Writing, essay, research, and communication',
      '2026-10-30',
      '2026-10-01',
      'https://forms.gle/NHx8nTw5CuRG7u6EA',
      'Read the official competition announcement at https://tpacolloquium.org/essay2026/, prepare one original unpublished entry in the required word range, format it as a double-spaced 12-point Times New Roman PDF or Word document, and submit it through the linked official form before 30 October 2026. The cover page must include name, institution, level or class, contact details, and category. AI-generated or plagiarized entries are disqualified.',
      true,
      'Verified 2026-10-27 against the official TPA Colloquium competition page https://tpacolloquium.org/essay2026/. The official page confirms the three categories, category prizes, topics, submission window, word limits, formatting requirements, cover-page requirements, one-entry limit, originality rule, and the official submission form link.'
    ) returning id into v_tpa_id;
  else
    update public.opportunities set
      type = 'competition',
      title = 'TPA Colloquium National Essay & Article Competition 2026',
      provider_name = 'TPA Colloquium',
      description = 'A national essay and article competition on the Brand Nigeria conversation, with separate postgraduate, undergraduate, and secondary-school categories.',
      eligibility_notes = 'Open to Nigerians in postgraduate, undergraduate, and secondary-school categories. The undergraduate topic is “The Brand Nigeria: From Potential to Global Recognition — How Can Education, Entrepreneurship, Technology, and Creativity Help Strengthen Nigeria''s Global Brand?”',
      duration = 'Submission window: 1 October–30 October 2026. Undergraduate and postgraduate entries must be 2,500–3,000 words; secondary-school entries must be 1,000–1,500 words.',
      location = 'Nigeria; online submission',
      compensation = 'Postgraduate ₦1,000,000; undergraduate ₦750,000; secondary school ₦500,000',
      discipline = 'Writing, essay, research, and communication',
      deadline = '2026-10-30',
      opens_at = '2026-10-01',
      application_url = 'https://forms.gle/NHx8nTw5CuRG7u6EA',
      how_to_apply = 'Read the official competition announcement at https://tpacolloquium.org/essay2026/, prepare one original unpublished entry in the required word range, format it as a double-spaced 12-point Times New Roman PDF or Word document, and submit it through the linked official form before 30 October 2026. The cover page must include name, institution, level or class, contact details, and category. AI-generated or plagiarized entries are disqualified.',
      verified = true,
      research_notes = 'Verified 2026-10-27 against the official TPA Colloquium competition page https://tpacolloquium.org/essay2026/. The official page confirms the three categories, category prizes, topics, submission window, word limits, formatting requirements, cover-page requirements, one-entry limit, originality rule, and the official submission form link.'
    where id = v_tpa_id;
  end if;

  -- Kayode Aderinokun Poetry Prize (KAPP) 2026.
  select id into v_kapp_id
  from public.opportunities
  where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLSfLN2sFH51JAXKRox57ONWiLl9-w1rq9DmovPsKl8NqoNcAJw/viewform'
     or lower(title) = lower('Kayode Aderinokun Poetry Prize (KAPP) 2026')
  order by created_at desc
  limit 1;

  if v_kapp_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'competition',
      'Kayode Aderinokun Poetry Prize (KAPP) 2026',
      'LABAF / Committee for Relevant Art (CORA)',
      'A poetry and spoken-word competition inviting participants to showcase original creative work through a short poetry video and social-media submission.',
      'The supplied form requests a name, email address, phone number, and confirmation of following @Labaf. Published 2026 coverage describes the opportunity as open to poets, spoken-word artists, and lovers of words; confirm any additional age, nationality, or judging requirements with LABAF before submitting.',
      'Create a poetry video of no more than five minutes, post it on social media, and tag @Labaf. The associated 2026 event is scheduled for 18–19 November 2026.',
      'Freedom Park, Lagos Island, Nigeria; online entry',
      '₦1,000,000 first prize; ₦500,000 second prize; ₦300,000 third prize; additional jury special prizes may apply',
      'Poetry, spoken word, and creative arts',
      null,
      null,
      'https://docs.google.com/forms/d/e/1FAIpQLSfLN2sFH51JAXKRox57ONWiLl9-w1rq9DmovPsKl8NqoNcAJw/viewform',
      'Create a poetry performance video of no more than five minutes, publish it on your social-media account, tag @Labaf, and complete the supplied registration form. The form does not state a final submission deadline, so applicants should confirm the closing date and full rules with LABAF before submitting.',
      true,
      'Verified 2026-10-27 using the supplied Google Form, which is titled Kayode Aderinokun Poetry Prize (KAPP) and requests participant contact details plus @Labaf follow confirmation; the current independent 2026 listing https://www.icanstudent.com/kayode-aderinokun-poetry-prize-2026/ for the form link and prize/event details; and the KAPP background page https://teambooktu.com/the-kayode-aderinokun-poetry-prize/ identifying CORA and Teambooktu as the recurring poetry-prize organizers. The form itself does not publish a final deadline, so no unsupported deadline is stored.'
    ) returning id into v_kapp_id;
  else
    update public.opportunities set
      type = 'competition',
      title = 'Kayode Aderinokun Poetry Prize (KAPP) 2026',
      provider_name = 'LABAF / Committee for Relevant Art (CORA)',
      description = 'A poetry and spoken-word competition inviting participants to showcase original creative work through a short poetry video and social-media submission.',
      eligibility_notes = 'The supplied form requests a name, email address, phone number, and confirmation of following @Labaf. Published 2026 coverage describes the opportunity as open to poets, spoken-word artists, and lovers of words; confirm any additional age, nationality, or judging requirements with LABAF before submitting.',
      duration = 'Create a poetry video of no more than five minutes, post it on social media, and tag @Labaf. The associated 2026 event is scheduled for 18–19 November 2026.',
      location = 'Freedom Park, Lagos Island, Nigeria; online entry',
      compensation = '₦1,000,000 first prize; ₦500,000 second prize; ₦300,000 third prize; additional jury special prizes may apply',
      discipline = 'Poetry, spoken word, and creative arts',
      deadline = null,
      opens_at = null,
      application_url = 'https://docs.google.com/forms/d/e/1FAIpQLSfLN2sFH51JAXKRox57ONWiLl9-w1rq9DmovPsKl8NqoNcAJw/viewform',
      how_to_apply = 'Create a poetry performance video of no more than five minutes, publish it on your social-media account, tag @Labaf, and complete the supplied registration form. The form does not state a final submission deadline, so applicants should confirm the closing date and full rules with LABAF before submitting.',
      verified = true,
      research_notes = 'Verified 2026-10-27 using the supplied Google Form, which is titled Kayode Aderinokun Poetry Prize (KAPP) and requests participant contact details plus @Labaf follow confirmation; the current independent 2026 listing https://www.icanstudent.com/kayode-aderinokun-poetry-prize-2026/ for the form link and prize/event details; and the KAPP background page https://teambooktu.com/the-kayode-aderinokun-poetry-prize/ identifying CORA and Teambooktu as the recurring poetry-prize organizers. The form itself does not publish a final deadline, so no unsupported deadline is stored.'
    where id = v_kapp_id;
  end if;
end
$migration$;
