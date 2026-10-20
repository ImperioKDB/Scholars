-- Verified 2026-10-20 against official provider pages and the supplied ScholarshipAir pages.
-- Dele Awe Foundation Scholarship 2026 is intentionally excluded: its official site
-- confirms the recurring scholarship, but does not substantiate the listed 2026 cycle dates.

do $migration$
declare
  v_afriseed_id uuid;
begin
  if not exists (
    select 1 from public.scholarships
    where application_url = 'https://admissions.earth.ac.cr/Application'
    limit 1
  ) then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply, last_verified_at
    ) values (
      'EARTH University Mastercard Foundation Scholarship 2027',
      'EARTH University and Mastercard Foundation',
      'Need-based scholarship support for eligible students admitted to EARTH University’s four-year Agricultural Sciences degree. The scholarship is for candidates whose financial circumstances would otherwise prevent university attendance. Admission is required first; support is assessed through a socioeconomic study and selection process. Award coverage and amount vary by individual financial-support decision.',
      'Scholarship support; amount varies and is determined after admission and socioeconomic review',
      '2027-01-31',
      'https://admissions.earth.ac.cr/Application',
      'undergrad',
      'Agricultural Sciences',
      true,
      'Verified 2026-10-20 against the official EARTH University Mastercard Foundation Scholars Program page https://www.earth.ac.cr/friends-allies/mastercard-foundation-scholars-program/, EARTH official admissions process and timeline https://admissions.earth.ac.cr/Application, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10232. EARTH confirms that eligible candidates must meet university admission criteria, that financial circumstances are assessed through a socioeconomic study after the admissions process, and that full and partial scholarship support exists. The official admissions page states applications are received October 15 through January 31; the supplied 2027 listing identifies this intake as the 2027 cycle. The official university page does not guarantee a fixed award amount or full funding for every applicant. Three recommendation letters, high-school transcripts for the last three years, a diploma or completion certificate, and other supporting documents are listed by EARTH.',
      'Start through EARTH’s official admissions process. Submit the university application and required academic documents by 31 January 2027, then complete admission tests/interviews and the socioeconomic review if selected. Scholarship support is assessed as part of the admissions/financial-support process; it is not a separate guaranteed award.',
      now()
    );
  end if;

  if not exists (
    select 1 from public.scholarships
    where application_url = 'https://forms.gle/kJSMdxUGbv45PwjM6'
    limit 1
  ) then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply, last_verified_at
    ) values (
      'AfriSEED Foundation Root Initiative 2026',
      'AfriSEED Foundation',
      'Annual education-access program for financially disadvantaged Nigerian students who have completed or are about to complete secondary school and intend to attend university. Support covers WAEC/WASSCE, JAMB/UTME and required Post-UTME examination fees, alongside mentorship and scholarship guidance. The foundation states that each annual cohort admits 15 students; no cash award is offered.',
      'WAEC/WASSCE, JAMB/UTME and applicable Post-UTME examination fees; no cash award',
      '2026-11-15',
      'https://forms.gle/kJSMdxUGbv45PwjM6',
      'undergrad',
      null,
      true,
      'Verified 2026-10-20 against AfriSEED Foundation’s official Root Initiative page https://afriseedfoundation.org/our-programs/ and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10256. The official page states applications open 2026-10-19 and close 2026-11-15 at 11:59 PM WAT; it confirms examination-fee support for WAEC/WASSCE, UTME/JAMB and Post-UTME, annual admission of 15 students, mentorship, and scholarship guidance. Eligibility is reviewed holistically and includes financial need, strong school performance, two recommendations, intention to pursue university, Nigerian nationality or legal residency, and secondary-school completion or imminent graduation. The official portal link is published on the Foundation page.',
      'Apply through the official AfriSEED application form by 15 November 2026 at 11:59 PM WAT. Applicants should be Nigerian nationals or legal residents, have completed or be about to complete secondary school, demonstrate financial need and strong academics, provide a teacher recommendation and a second recommendation, and intend to pursue university education.',
      now()
    ) returning id into v_afriseed_id;
  else
    select id into v_afriseed_id from public.scholarships
    where application_url = 'https://forms.gle/kJSMdxUGbv45PwjM6'
    limit 1;
  end if;

  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_afriseed_id and field = 'nationality'
      and operator = 'eq' and value = '"Nigerian"'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_afriseed_id, 'nationality', 'eq', '"Nigerian"'::jsonb, true);
  end if;
  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_afriseed_id and field = 'financial_need'
      and operator = 'eq' and value = 'true'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_afriseed_id, 'financial_need', 'eq', 'true'::jsonb, true);
  end if;

  if not exists (
    select 1 from public.scholarships
    where application_url = 'https://www.sciencespo.fr/students/en/fees-funding/bursaries-financial-aid/emile-boutmy-scholarship/'
    limit 1
  ) then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply, last_verified_at
    ) values (
      'Émile Boutmy Scholarship 2027 — Undergraduate',
      'Sciences Po',
      'Merit-based tuition support for first-time applicants from outside the European Union who are admitted to the first year of an eligible Sciences Po undergraduate programme and whose household does not pay taxes in the EU. The award is a full tuition exemption or a €9,500 tuition-fee exemption; it is not a cash stipend.',
      'Full tuition exemption or €9,500 tuition-fee exemption',
      '2027-01-13',
      'https://www.sciencespo.fr/students/en/fees-funding/bursaries-financial-aid/emile-boutmy-scholarship/',
      'undergrad',
      null,
      true,
      'Verified 2026-10-20 against Sciences Po’s official Émile Boutmy scholarship page https://www.sciencespo.fr/students/en/fees-funding/bursaries-financial-aid/emile-boutmy-scholarship/ and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10258. Sciences Po confirms eligibility for first-time applicants from outside the EU whose household does not file taxes in the EU, admission to an eligible undergraduate programme, and either a full exemption or €9,500 tuition exemption. The official deadline for undergraduate applicants from foreign secondary schools is 2027-01-13. The scholarship application must be indicated in the Financial Information section of the Sciences Po admission application. This listing is specifically for the undergraduate foreign-secondary-school route; separate deadlines apply to French-secondary-school and Master’s applicants.',
      'Apply to an eligible Sciences Po undergraduate programme and indicate that you are applying for the Émile Boutmy scholarship in the Financial Information section of the application. The deadline for applicants from foreign secondary schools is 13 January 2027. Applicants must be first-time applicants from outside the EU, have a household that does not file taxes in the EU, and be admitted to an eligible programme.',
      now()
    );
  end if;

  if not exists (
    select 1 from public.opportunities
    where application_url = 'https://pregradadmissions-afretec.engineering.cmu.edu/apply/?sr=c710f69e-de1e-4ff6-90c3-977392fc7c2c'
    limit 1
  ) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'training',
      'CMU-Africa Certificate in Artificial Intelligence for Africa 2026',
      'Carnegie Mellon University Africa',
      'Cost-free six-course online certificate for qualified learners interested in AI applications relevant to Africa. The courses cover AI context, Python, mathematical foundations, machine learning and generative AI. It is not for university credit; learners earn digital badges and a verifiable completion certificate.',
      'Applicants need introductory knowledge of linear algebra, probability and statistics, computer programming, reliable internet and a laptop or desktop. Plan at least five hours weekly. Applications and recommendations are open to qualified learners for the January 2027 cohort.',
      'Six online courses; January 2027 cohort',
      'Online; Carnegie Mellon University Africa, Kigali, Rwanda',
      'Cost-free for qualified applicants; no cash award',
      'Artificial Intelligence',
      '2026-11-15',
      '2026-10-15',
      'https://pregradadmissions-afretec.engineering.cmu.edu/apply/?sr=c710f69e-de1e-4ff6-90c3-977392fc7c2c',
      'Apply through the official CMU-Africa application portal by 15 November 2026. Submit your contact and academic background, professional experience, CV and a brief statement of professional goals. Enrollment is by invitation based on the application and available space.',
      true,
      'Verified 2026-10-20 against CMU-Africa’s official certificate page https://www.africa.engineering.cmu.edu/academics/ai-certificate/index.html, official apply page https://www.africa.engineering.cmu.edu/academics/ai-certificate/apply.html, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10254. CMU confirms that applications and recommendations run 15 October–15 November 2026, the new cohort starts 17 January 2027, the certificate is cost-free for qualified applicants, and the stated prerequisites and application materials. This is a training opportunity, not a cash scholarship.'
    );
  end if;

  if not exists (
    select 1 from public.opportunities
    where application_url = 'https://sycomail-dev-web.azurewebsites.net/p/sycom-scholar-2026'
    limit 1
  ) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, discipline, deadline, opens_at, application_url,
      how_to_apply, verified, research_notes
    ) values (
      'training',
      'Sycom Cybersecurity Talent Pipeline Scholarship Programme 2026/27',
      'Sycom Academy',
      'Free six-week entry-level cybersecurity training programme for 20 participants across Africa, with online expert-led sessions, hands-on labs, project work and certification exam vouchers. The five strongest participants will be sponsored for Sycom’s advanced cybersecurity training with work experience and mentorship; that sponsorship is competitive and not guaranteed to all participants.',
      'Open to applicants from any African country, with 10 places for men and 10 for women. No previous cybersecurity experience is required. Applicants should be passionate about cybersecurity, commit six hours per week for six weeks, and explain the programme’s impact in a personal statement.',
      'Six weeks; six hours of online training per week',
      'Online; applicants across Africa',
      'Free training and certification exam voucher for selected participants; top five receive further sponsored training with work experience and mentorship',
      'Cybersecurity',
      '2026-10-31',
      '2026-10-01',
      'https://sycomail-dev-web.azurewebsites.net/p/sycom-scholar-2026',
      'Submit the online application and personal statement through Sycom Academy’s programme page by 31 October 2026. Applicants must commit to the six-week programme and its weekly assignments, quizzes and projects.',
      true,
      'Verified 2026-10-20 against Sycom Academy’s official 2026/27 programme page https://sycom.academy/entry-level/. The page states that applications opened 1 October and close 31 October 2026; the course is six weeks, six online hours weekly, with 20 participants split equally between men and women from any African country. It states that all selected participants receive free training and certification exam vouchers, while only the top five will be sponsored for advanced training with work experience and mentorship. The linked official application route is https://sycomail-dev-web.azurewebsites.net/p/sycom-scholar-2026. This is a training programme, not a general cash scholarship.'
    );
  end if;
end
$migration$;
