-- Verified 2026-11-19 against the provider/application sources recorded below.
-- The supplied Apple aggregator article contains stale and uncorroborated claims;
-- only Apple's current student internship catalogue is published. The Microsoft
-- registration form does not show a closing date, so the reported third-party
-- date is retained as an admin caveat and not set as a public deadline.
do $migration$
declare
  v_id uuid;
begin
  -- De_Light Foundation Undergraduate Scholarship & Mentorship Programme.
  select id into v_id
  from public.scholarships
  where application_url = 'https://docs.google.com/forms/d/e/1FAIpQLScN00yNEdpZWoFmqSXpVG2CdOJf6AhnCvRphRbngXKFfxa0cw/viewform'
     or lower(title) = lower('De_Light Foundation Undergraduate Scholarship & Mentorship Programme')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, last_verified_at
    ) values (
      'De_Light Foundation Undergraduate Scholarship & Mentorship Programme',
      'De_Light Foundation',
      'Financial assistance toward school fees for undergraduates at recognised Nigerian tertiary institutions who demonstrate genuine financial need and are committed to their education. Selected scholars also receive mentorship and guidance on spiritual growth, academic progress, personal development, and campus life. Christian applicants receive priority; a limited number of non-Christian students may also be considered.',
      'Financial assistance toward school fees; specific award amount not stated',
      null,
      'https://docs.google.com/forms/d/e/1FAIpQLScN00yNEdpZWoFmqSXpVG2CdOJf6AhnCvRphRbngXKFfxa0cw/viewform',
      'undergrad',
      null,
      true,
      'Verified 2026-11-19 against the provider programme page https://delightfoundation.vercel.app/scholarship.html and its linked application form https://docs.google.com/forms/d/e/1FAIpQLScN00yNEdpZWoFmqSXpVG2CdOJf6AhnCvRphRbngXKFfxa0cw/viewform. The provider page says support is toward school fees, requires genuine financial need and current undergraduate enrolment at a recognised Nigerian tertiary institution, prioritises Christian applicants, and allows a limited number of non-Christian students to be considered. It describes an approximate ratio of two to three scholars per mentor and periodic virtual mentoring. No award amount or deadline is published. The provider page displays an Apply Now link, but the Google Form opened a Google sign-in screen during verification, so response acceptance and form questions could not be independently confirmed. Confirm that the form is accepting applications before submitting.',
      'Apply through the form linked from the De_Light Foundation scholarship page. Prepare a motivation letter explaining your background, educational goals, financial circumstances, and reasons for applying. Applicants in 200 level and above should provide an academic transcript; applicants who do not yet have one should indicate this. Submit two recommendation letters: one from an academic referee and one from a church/religious or appropriate community leader. The Foundation page does not state a closing date. The form may require Google sign-in; confirm it is accepting responses before submitting.',
      null,
      now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'De_Light Foundation Undergraduate Scholarship & Mentorship Programme',
      provider_name = 'De_Light Foundation',
      description = 'Financial assistance toward school fees for undergraduates at recognised Nigerian tertiary institutions who demonstrate genuine financial need and are committed to their education. Selected scholars also receive mentorship and guidance on spiritual growth, academic progress, personal development, and campus life. Christian applicants receive priority; a limited number of non-Christian students may also be considered.',
      amount = 'Financial assistance toward school fees; specific award amount not stated',
      deadline = null,
      application_url = 'https://docs.google.com/forms/d/e/1FAIpQLScN00yNEdpZWoFmqSXpVG2CdOJf6AhnCvRphRbngXKFfxa0cw/viewform',
      level = 'undergrad',
      discipline = null,
      verified = true,
      research_notes = 'Verified 2026-11-19 against the provider programme page https://delightfoundation.vercel.app/scholarship.html and its linked application form https://docs.google.com/forms/d/e/1FAIpQLScN00yNEdpZWoFmqSXpVG2CdOJf6AhnCvRphRbngXKFfxa0cw/viewform. The provider page says support is toward school fees, requires genuine financial need and current undergraduate enrolment at a recognised Nigerian tertiary institution, prioritises Christian applicants, and allows a limited number of non-Christian students to be considered. It describes an approximate ratio of two to three scholars per mentor and periodic virtual mentoring. No award amount or deadline is published. The provider page displays an Apply Now link, but the Google Form opened a Google sign-in screen during verification, so response acceptance and form questions could not be independently confirmed. Confirm that the form is accepting applications before submitting.',
      how_to_apply = 'Apply through the form linked from the De_Light Foundation scholarship page. Prepare a motivation letter explaining your background, educational goals, financial circumstances, and reasons for applying. Applicants in 200 level and above should provide an academic transcript; applicants who do not yet have one should indicate this. Submit two recommendation letters: one from an academic referee and one from a church/religious or appropriate community leader. The Foundation page does not state a closing date. The form may require Google sign-in; confirm it is accepting responses before submitting.',
      opens_at = null,
      last_verified_at = now()
    where id = v_id;
  end if;

  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_id
      and field = 'financial_need'
      and operator = 'eq'
      and value = 'true'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'financial_need', 'eq', 'true'::jsonb, true);
  end if;

  -- Apple's current student internship listings, not the stale blanket claims
  -- in the user-supplied aggregator article.
  select id into v_id
  from public.opportunities
  where application_url = 'https://jobs.apple.com/en-us/search?team=Internships-STDNT-INTRN'
     or lower(title) = lower('Apple Student Internships (Open Role Listings)')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'internship',
      'Apple Student Internships (Open Role Listings)',
      'Apple Inc.',
      'Apple publishes role-specific internships for students, including summer internships and academic-year co-ops. Current listings cover different teams and locations; role duties, dates, hours, and requirements vary by posting.',
      'Apple’s student careers page says applicants should be enrolled full-time in a bachelor’s, master’s, or doctoral programme. Technical and nontechnical fields are represented. Each role has its own location and qualifications; worldwide eligibility is not guaranteed.',
      'Summer internship or academic-year co-op; duration varies by role',
      'On an Apple campus; location varies by role',
      null,
      'Role-dependent',
      null,
      null,
      'https://jobs.apple.com/en-us/search?team=Internships-STDNT-INTRN',
      'Search Apple’s official Students: Internships listings and open a current role to review its location, dates, qualifications, and application instructions. Apply to the specific role through Apple Careers. The supplied Scholarship Region article claims a universal stipend of $7,000–$9,000 per month, worldwide eligibility, and a Summer 2026 term; those claims are not stated on Apple’s official student page and the cited Summer 2026 term has passed, so they are not included here.',
      true,
      'Verified 2026-11-19 against Apple’s official student careers page https://www.apple.com/careers/us/work-at-apple/students.html and official live internship search https://jobs.apple.com/en-us/search?team=Internships-STDNT-INTRN. Apple’s student page describes internships and academic-year co-ops for students enrolled full-time in bachelor’s, master’s, or doctoral programmes, with opportunities on Apple campuses. The live internship search displayed 127 role results when checked. The supplied Scholarship Region article https://www.scholarshipregion.com/apple-internship-programme/ claims $7,000–$9,000 monthly pay, worldwide eligibility, and a 12–16 week Summer 2026 term; Apple’s official pages do not substantiate a universal amount or worldwide eligibility, and that stated Summer 2026 term is past as of this verification date. The catalog entry therefore links to Apple’s current role-specific listings and does not repeat those claims.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'internship',
      title = 'Apple Student Internships (Open Role Listings)',
      provider_name = 'Apple Inc.',
      description = 'Apple publishes role-specific internships for students, including summer internships and academic-year co-ops. Current listings cover different teams and locations; role duties, dates, hours, and requirements vary by posting.',
      eligibility_notes = 'Apple’s student careers page says applicants should be enrolled full-time in a bachelor’s, master’s, or doctoral programme. Technical and nontechnical fields are represented. Each role has its own location and qualifications; worldwide eligibility is not guaranteed.',
      duration = 'Summer internship or academic-year co-op; duration varies by role',
      location = 'On an Apple campus; location varies by role',
      compensation = null,
      discipline = 'Role-dependent',
      deadline = null,
      opens_at = null,
      application_url = 'https://jobs.apple.com/en-us/search?team=Internships-STDNT-INTRN',
      how_to_apply = 'Search Apple’s official Students: Internships listings and open a current role to review its location, dates, qualifications, and application instructions. Apply to the specific role through Apple Careers. The supplied Scholarship Region article claims a universal stipend of $7,000–$9,000 per month, worldwide eligibility, and a Summer 2026 term; those claims are not stated on Apple’s official student page and the cited Summer 2026 term has passed, so they are not included here.',
      verified = true,
      research_notes = 'Verified 2026-11-19 against Apple’s official student careers page https://www.apple.com/careers/us/work-at-apple/students.html and official live internship search https://jobs.apple.com/en-us/search?team=Internships-STDNT-INTRN. Apple’s student page describes internships and academic-year co-ops for students enrolled full-time in bachelor’s, master’s, or doctoral programmes, with opportunities on Apple campuses. The live internship search displayed 127 role results when checked. The supplied Scholarship Region article https://www.scholarshipregion.com/apple-internship-programme/ claims $7,000–$9,000 monthly pay, worldwide eligibility, and a 12–16 week Summer 2026 term; Apple’s official pages do not substantiate a universal amount or worldwide eligibility, and that stated Summer 2026 term is past as of this verification date. The catalog entry therefore links to Apple’s current role-specific listings and does not repeat those claims.'
    where id = v_id;
  end if;

  -- Microsoft Datacenter Academy Skilling Bootcamp; use the provider-hosted
  -- registration form for dates, criteria, and the direct application path.
  select id into v_id
  from public.opportunities
  where application_url = 'https://forms.cloud.microsoft/pages/responsepage.aspx?id=v4j5cvGGr0GRqy180BHbR1d6wCZXMv1Htb-XI2Og10ZUQkJEUzgxRTJJU1Q2RVNTVVhYVlhFWjJJUi4u'
     or lower(title) = lower('Microsoft Datacenter Academy Skilling Bootcamp (January 2027 EMEA Cohort)')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'training',
      'Microsoft Datacenter Academy Skilling Bootcamp (January 2027 EMEA Cohort)',
      'Microsoft',
      'A free, 12-week virtual learning programme for people interested in careers in the datacenter industry. Microsoft’s registration form says the next cohort starts 11 January 2027 and selected learners will receive confirmation emails by 21 December 2026. In-person graduation events may be available in selected countries.',
      'Applicants must be located in Europe, the Middle East, or Africa; be at least 18; have completed secondary education or equivalent; be able to commit 45–90 minutes per day for 10–12 weeks (at least five hours weekly); and have intermediate English proficiency. The programme is open to career changers, upskillers, reskillers, and beginners; no prior IT experience is required.',
      '12 weeks; next cohort starts 11 January 2027',
      'Virtual for EMEA residents; in-person graduation events in selected countries',
      null,
      'Datacenter operations and IT infrastructure',
      null,
      null,
      'https://forms.cloud.microsoft/pages/responsepage.aspx?id=v4j5cvGGr0GRqy180BHbR1d6wCZXMv1Htb-XI2Og10ZUQkJEUzgxRTJJU1Q2RVNTVVhYVlhFWjJJUi4u',
      'Complete the official Microsoft Forms registration. The form asks for contact and residence details, education and age confirmation, availability, English proficiency, career interest, and acknowledgement of Microsoft’s Data Privacy Notice. Microsoft’s form states that the cohort starts 11 January 2027 and selected learners receive confirmation by 21 December 2026. The supplied Scholarship Region article and another opportunity listing report 18 December 2026 as an application deadline, but the Microsoft form itself does not display a closing date; apply promptly and confirm any final cutoff with the provider.',
      true,
      'Verified 2026-11-19 against Microsoft’s live registration form https://forms.cloud.microsoft/pages/responsepage.aspx?id=v4j5cvGGr0GRqy180BHbR1d6wCZXMv1Htb-XI2Og10ZUQkJEUzgxRTJJU1Q2RVNTVVhYVlhFWjJJUi4u and official Datacenter Academy overview https://careers.microsoft.com/v2/global/en/datacenteracademy.html. The Microsoft form confirms a free 12-week virtual programme, EMEA location requirement, age 18+, completed secondary education, 45–90 minutes daily for 10–12 weeks, intermediate English, a 11 January 2027 cohort start, and selected-learner confirmation by 21 December 2026; it was live and soliciting registrations during review. The supplied Scholarship Region listing https://www.scholarshipregion.com/microsoft-datacenter-academy-skilling-bootcamp/ and Opportunities for Africans https://www.opportunitiesforafricans.com/the-microsoft-datacenter-academy-skilling-bootcamp-for-africans-and-emea-learners/ report an 18 December 2026 application deadline, while the Microsoft form does not show a closing date. The public deadline is therefore left blank; applicants are advised to submit promptly.'
    ) returning id into v_id;
  else
    update public.opportunities set
      type = 'training',
      title = 'Microsoft Datacenter Academy Skilling Bootcamp (January 2027 EMEA Cohort)',
      provider_name = 'Microsoft',
      description = 'A free, 12-week virtual learning programme for people interested in careers in the datacenter industry. Microsoft’s registration form says the next cohort starts 11 January 2027 and selected learners will receive confirmation emails by 21 December 2026. In-person graduation events may be available in selected countries.',
      eligibility_notes = 'Applicants must be located in Europe, the Middle East, or Africa; be at least 18; have completed secondary education or equivalent; be able to commit 45–90 minutes per day for 10–12 weeks (at least five hours weekly); and have intermediate English proficiency. The programme is open to career changers, upskillers, reskillers, and beginners; no prior IT experience is required.',
      duration = '12 weeks; next cohort starts 11 January 2027',
      location = 'Virtual for EMEA residents; in-person graduation events in selected countries',
      compensation = null,
      discipline = 'Datacenter operations and IT infrastructure',
      deadline = null,
      opens_at = null,
      application_url = 'https://forms.cloud.microsoft/pages/responsepage.aspx?id=v4j5cvGGr0GRqy180BHbR1d6wCZXMv1Htb-XI2Og10ZUQkJEUzgxRTJJU1Q2RVNTVVhYVlhFWjJJUi4u',
      how_to_apply = 'Complete the official Microsoft Forms registration. The form asks for contact and residence details, education and age confirmation, availability, English proficiency, career interest, and acknowledgement of Microsoft’s Data Privacy Notice. Microsoft’s form states that the cohort starts 11 January 2027 and selected learners receive confirmation by 21 December 2026. The supplied Scholarship Region article and another opportunity listing report 18 December 2026 as an application deadline, but the Microsoft form itself does not display a closing date; apply promptly and confirm any final cutoff with the provider.',
      verified = true,
      research_notes = 'Verified 2026-11-19 against Microsoft’s live registration form https://forms.cloud.microsoft/pages/responsepage.aspx?id=v4j5cvGGr0GRqy180BHbR1d6wCZXMv1Htb-XI2Og10ZUQkJEUzgxRTJJU1Q2RVNTVVhYVlhFWjJJUi4u and official Datacenter Academy overview https://careers.microsoft.com/v2/global/en/datacenteracademy.html. The Microsoft form confirms a free 12-week virtual programme, EMEA location requirement, age 18+, completed secondary education, 45–90 minutes daily for 10–12 weeks, intermediate English, a 11 January 2027 cohort start, and selected-learner confirmation by 21 December 2026; it was live and soliciting registrations during review. The supplied Scholarship Region listing https://www.scholarshipregion.com/microsoft-datacenter-academy-skilling-bootcamp/ and Opportunities for Africans https://www.opportunitiesforafricans.com/the-microsoft-datacenter-academy-skilling-bootcamp-for-africans-and-emea-learners/ report an 18 December 2026 application deadline, while the Microsoft form does not show a closing date. The public deadline is therefore left blank; applicants are advised to submit promptly.'
    where id = v_id;
  end if;
end
$migration$;
