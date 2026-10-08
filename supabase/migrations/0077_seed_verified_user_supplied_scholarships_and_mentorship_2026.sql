-- Publish three opportunities from the supplied links after checking the
-- providers' current official pages and announcements on 2026-10-08.
-- The Google AI student plan is a non-cash subscription promotion, and the
-- supplied SMEDAN CGS page is a nano-business grant rather than student aid;
-- neither belongs in this student scholarship/mentorship catalog.

do $migration$
declare
  v_amir_id uuid;
begin
  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://forms.gle/fT1brX6sW2D2ENFF9'
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
      'AMIR Fund Medical Scholarship Program 2026/2027',
      'AMIR Fund for Education, Science and Technology',
      'Full tuition and mandatory-fee support for Nigerian MBBS and BDS students from low-income households and faith-based minority communities. Applicants must be in 200 Level or above, have at least 3.50/5.00 CGPA (or equivalent), and attend one of these eligible government universities: University of Ibadan, University of Lagos, Obafemi Awolowo University, Ahmadu Bello University, Bayero University Kano, University of Ilorin, University of Nigeria, University of Benin, Lagos State University, Olabisi Onabanjo University, or the Federal University of Medicine and Medical Sciences, Abeokuta. Up to 20 scholarships are offered; the award is paid to the university and renewable annually subject to academic performance. The institution-list and community criteria must be checked manually because the student profile does not capture them.',
      'Full tuition and mandatory fees; up to 20 scholarships, paid directly to the university',
      '2026-10-30',
      'https://forms.gle/fT1brX6sW2D2ENFF9',
      'undergrad',
      null,
      true,
      'Verified 2026-10-08 against the AMIR Fund official program page https://www.amirfund.org/medical and official announcement https://www.amirfund.org/news-medical-scholarship. The announcement links the supplied forms.gle URL and states applications close 2026-10-30; the program page says interviews run through 2026-11-27. Both official pages say applying is free and no payment is ever requested. The Google Form displayed a sign-in prompt in this review, so its questions and live response state were not independently inspected. Contact fund@amirfund.org if the form cannot be accessed. Structured match rules cover Nigerian nationality, Medicine and Surgery/Dentistry, GPA >= 3.5, year of study >= 200, financial need, and public-university institution type. The exact eligible university list and faith-based minority-community criterion are not represented in the student profile and remain manual checks.',
      'Apply through the Google Form linked by the official AMIR Fund announcement before 30 October 2026. Prepare proof of Nigerian nationality, MBBS/BDS enrolment at an eligible listed public university, current CGPA, and household financial need. The form requested Google sign-in during verification; if you cannot access it, contact fund@amirfund.org. Applying is free; do not pay an intermediary.',
      '2026-10-08',
      now()
    ) returning id into v_amir_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values
      (v_amir_id, 'nationality', 'eq', '"Nigerian"'::jsonb),
      (v_amir_id, 'discipline', 'in', '["Medicine and Surgery", "Dentistry"]'::jsonb),
      (v_amir_id, 'gpa', 'gte', '3.5'::jsonb),
      (v_amir_id, 'year_of_study', 'gte', '200'::jsonb),
      (v_amir_id, 'financial_need', 'eq', 'true'::jsonb),
      (v_amir_id, 'institution_type', 'in', '["federal_uni", "state_uni"]'::jsonb);
  end if;

  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://gofscholarship.candsyf.org/'
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
      last_verified_at
    ) values (
      'Pro. Dr. Gabriel Olubunmi Fakeye Scholarship & Bursary Award 2027',
      'CANDSYF — Youth Fellowship of the Cherubim and Seraphim Movement Church, Surulere District',
      'An undergraduate scholarship or bursary for members of the Cherubim and Seraphim Movement Church, Surulere District branches. The 2027 application page requires church membership, a minimum CGPA of 3.5 for the scholarship or 3.0 for the bursary, an admission letter and latest academic result/current CGPA signed by an authorized institutional officer, a branch-leader recommendation (or an explanation if unavailable), and a passport photo. This is a church- and district-restricted award. The page reviewed does not state the award amount; applicants should confirm the amount and track directly with the organization.',
      'Scholarship or bursary; award value not stated on the official application page',
      '2026-12-04',
      'https://gofscholarship.candsyf.org/',
      'undergrad',
      'All disciplines',
      true,
      'Verified 2026-10-08 against the supplied CANDSYF 2027 application page https://gofscholarship.candsyf.org/ and the organization homepage https://www.candsyf.org/. The supplied page states applications are open for the 2027 session and close 2026-12-04, and lists the church membership, CGPA, and document requirements recorded here. The main site identifies CANDSYF as the Youth Fellowship facilitated by the Cherubim and Seraphim Movement Church, Surulere District Headquarters, Lagos. Award amounts and actual disbursements were not independently verified and are not claimed. Church membership is not a profile field, so students must self-check this condition before applying.',
      'Complete the 2027 application on the official portal before 4 December 2026. Upload the admission letter and latest signed academic result/current CGPA, branch-leader recommendation (or the portal-requested explanation if unavailable), and passport photograph, within the portal file limits. Confirm whether you are applying for the scholarship or bursary and verify its award amount with CANDSYF before submitting.',
      now()
    );
  end if;

  if not exists (
    select 1
    from public.opportunities
    where application_url = 'https://umsl.az1.qualtrics.com/jfe/form/SV_2blWkbzWN2x6hLw'
  ) then
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
      'mentorship',
      'POHER Scholars Program 2027 — Medical Research Mentorship',
      'Pan-African Organization for Health, Education and Research (POHER)',
      'A research and career mentorship opportunity for African biomedical trainees. POHER describes support for developing clinical research projects, learning research principles and good clinical practice, presenting work in progress for mentor feedback, networking, and career development. POHER’s published program page says the Scholars program does not pay medical-school tuition; no 2027 cash award or stipend was verified.',
      'POHER’s current 2027 announcement confirms that applications are open and gives an October 31, 2026 deadline, but does not publish the 2027 eligibility criteria. The organization’s program page currently shows 2025 selection criteria: enrolled in an African medical school (MD/MBBS/MBChB or equivalent), graduating after January 2026, research interest, leadership potential, motivation for mentorship, and commitment to program activities. Confirm the current 2027 criteria in the application instructions before applying.',
      'Program-year mentorship (2027 cohort schedule not independently confirmed)',
      'African medical schools; virtual research and mentorship activities described by POHER',
      'Non-cash mentorship; POHER says the program does not pay medical-school tuition; no stipend verified',
      'Medicine; clinical and biomedical research',
      '2026-10-31',
      null,
      'https://umsl.az1.qualtrics.com/jfe/form/SV_2blWkbzWN2x6hLw',
      'POHER’s official 2027 announcement says the application portal is open and directs applicants to read the instructions and criteria before applying by 31 October 2026. The supplied Qualtrics page remained on “Page is loading” during read-only inspection, so the 2027-specific form questions and criteria could not be verified. Confirm current requirements with POHER via pohersocialmedia@gmail.com before sharing sensitive information. The umsl.az1.qualtrics.com host is survey software and does not mean UMSL sponsors the program.',
      true,
      'Verified 2026-10-08 against POHER’s official 2027 announcement https://www.facebook.com/POHERUSA/posts/the-2027-pan-african-organization-for-health-education-and-research-poher-schola/1556275626527332/ and official Scholars page https://www.poher-usa.org/scholars. The Facebook post states the 2027 portal is open and the deadline is 2026-10-31; it links the supplied Qualtrics application. The official Scholars page describes research mentorship and says the program does not pay medical school, but its visible eligibility details and cohort information are for 2025. The supplied Qualtrics form remained on a loading screen during browser inspection. The UMSL Qualtrics host is not evidence of UMSL sponsorship; current cycle details are explicitly caveated in the public listing.'
    );
  end if;
end
$migration$;
