-- Publish two verified essay competitions and one verified veterinary scholarship
-- from their official current-cycle pages checked on 2026-10-09.
do $migration$
declare
  v_wva_id uuid;
begin
  if not exists (
    select 1 from public.opportunities
    where application_url = 'https://wearehelwa.org/essay-competition'
  ) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, deadline, opens_at, application_url, how_to_apply,
      verified, research_notes
    ) values (
      'competition',
      'HELWA Foundation Essay Competition 2026',
      'HELWA Foundation',
      'A national essay and short-video vision competition inviting young Nigerian women to share ideas and realistic solutions for issues affecting Nigeria. The 2026 prompt is “If I Were President for a Day…” and asks applicants to address a meaningful issue affecting Nigeria.',
      'Nigerian women aged 18–25 on the closing date who are currently enrolled students. Submit one original essay of no more than 1,500 words and an original vision video of no more than 60 seconds. AI-generated or copied submissions, previously published work, and late entries are not permitted.',
      '2026 competition; one submission per eligible participant',
      'Nigeria; online submission',
      'Competition prizes were not specified on the official page reviewed.',
      '2026-10-15',
      '2026-10-01',
      'https://wearehelwa.org/essay-competition',
      'Use the official competition page to complete the three-step application. Prepare applicant details, the original essay, and an accessible link to the original 60-second vision video. Review the submission carefully because the page states that submissions cannot be edited after sending.',
      true,
      'Verified 2026-10-09 against the official HELWA Foundation competition page https://wearehelwa.org/essay-competition and the foundation homepage https://wearehelwa.org/. The competition page states that submissions open 2026-10-01 and close 2026-10-15 at 11:59 p.m. WAT, identifies the prompt, eligibility, essay and video limits, originality requirements, and one-submission rule. The official page does not state prize amounts, so none are claimed. HELWA identifies itself as the Her Education, Literacy & Wellness Advancement Foundation, a Nigerian nonprofit focused on women and girls.',
      now(),
      now()
    );
  end if;

  if not exists (
    select 1 from public.opportunities
    where application_url = 'https://npw.ng/youth-engagement/essay/'
  ) then
    insert into public.opportunities (
      type, title, provider_name, description, eligibility_notes, duration,
      location, compensation, deadline, opens_at, application_url, how_to_apply,
      verified, research_notes
    ) values (
      'competition',
      'National Youth Pension Literacy Essay Competition 2026',
      'National Pension Week, led by the National Pension Commission (PenCom)',
      'A nationwide essay competition on “My Dream for a Great Retirement Experience in Nigeria”, encouraging young people to connect today’s choices, policies, and innovations with better retirement experiences. The competition has separate secondary-school and tertiary/NYSC categories.',
      'Category A: currently enrolled students at recognised Nigerian secondary schools; maximum 500 words. Category B: currently enrolled students at recognised Nigerian tertiary institutions or serving NYSC members; maximum 1,000 words. Each entrant may submit one original essay and shortlisted entrants must complete identity and student-status verification. Entrants under 18 require parent or legal guardian consent.',
      'Entries open 2026-10-01; winners announced 2026-10-26',
      'Nigeria; nationwide online competition',
      'Category A: ₦1,000,000 plus laptop, trophy, and certificate. Category B: ₦1,500,000 plus laptop, trophy, and certificate.',
      '2026-10-20',
      '2026-10-01',
      'https://npw.ng/youth-engagement/essay/',
      'Submit one original essay through the official NPW platform before 20 October 2026. Accepted formats are typed text, PDF, DOCX, or TXT, with a maximum upload size of 10 MB. Follow the published authorship, consent, and verification requirements.',
      true,
      'Verified 2026-10-09 against the official National Pension Week essay page https://npw.ng/youth-engagement/essay/ and official About page https://npw.ng/about/. The official page states entries open 2026-10-01, close 2026-10-20, and winners are announced 2026-10-26. It lists both categories, word limits, prizes, originality and anti-misrepresentation rules, accepted formats, upload limit, consent requirement for minors, and verification process. The About page identifies National Pension Week as a PenCom-led national programme with licensed pension-fund administrators participating.',
      now(),
      now()
    );
  end if;

  if not exists (
    select 1 from public.scholarships
    where application_url = 'https://app.smarterselect.com/programs/112061'
  ) then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      last_verified_at
    ) values (
      'WVA/MSD Veterinary Student Scholarship 2026',
      'World Veterinary Association and MSD Animal Health',
      'An undergraduate scholarship programme awarding 40 scholarships to veterinary students from eligible countries in Africa, Latin America, the Middle East/North Africa, and Asia/Oceania to improve their academic experience.',
      'US$5,000 per scholarship; 40 scholarships, US$200,000 total',
      '2026-10-15',
      'https://app.smarterselect.com/programs/112061',
      'undergrad',
      'Veterinary Medicine',
      true,
      'Verified 2026-10-09 against the World Veterinary Association''s official scholarship page https://worldvet.org/activities/msd-veterinary-student-scholarship/ and official FAQ https://worldvet.org/msd-veterinary-student-scholarship-faq/. The 2026 programme offers 40 scholarships of US$5,000 each. Applicants must be citizens or students in an eligible covered country, must not have won a prior WVA/MSD scholarship, must be matriculated in 2026–2027 at a recognised veterinary school, have completed first-year exams, and be in the second or third year or a later non-final year where the programme is longer than four years. Applications must be in English and applicants must be able to receive international funds through SWIFT to an account in their own name. The official FAQ confirms that the award is for undergraduate veterinary students, not Master''s or PhD students. Programme-year, final-year, region, and SWIFT checks remain manual because they are not all represented in the student profile.',
      'Apply through the official WVA SmarterSelect programme before 15 October 2026. Prepare the English application and any required supporting material in the format requested by the portal. Confirm that your country or study location is covered, that you are not in the first or final year, and that you can receive a SWIFT transfer into an account in your own name.',
      now()
    ) returning id into v_wva_id;

    insert into public.scholarship_rules (scholarship_id, field, operator, value)
    values
      (v_wva_id, 'discipline', 'in', '["Veterinary Medicine", "Veterinary Medicine and Surgery"]'::jsonb),
      (v_wva_id, 'year_of_study', 'gte', '200'::jsonb);
  end if;
end
$migration$;
