-- Publish the current Oyo State 2025/2026 bursary cycle, verified against
-- the official state bursary site and application form on 2026-10-15.
do $migration$
declare
  v_id uuid;
begin
  select id into v_id
  from public.scholarships
  where application_url = 'https://app.bursary.oyostate.gov.ng/bursary/apply'
     or lower(title) = lower('Oyo State Scholarship Bursary Award 2026')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, last_verified_at
    ) values (
      'Oyo State Scholarship Bursary Award 2026',
      'Oyo State Scholarship Board',
      'Financial support for Oyo State indigenes in their final year at a Nigerian public tertiary institution. Eligible groups include final-year university undergraduates, HND and NCE students, final-year clinical students, and aviation or maritime students. Final-year Law students are excluded. Private-institution, part-time and overseas students are not eligible. Applicants must be FOSSU members and have paid their 2026 membership dues. The official notice does not state the bursary amount.',
      'Amount not stated by the official Oyo State notice',
      '2026-11-02',
      'https://app.bursary.oyostate.gov.ng/bursary/apply',
      'undergrad', 'All disciplines', true,
      'Verified 2026-10-15 against the official Oyo State 2025/2026 Bursary Award page https://bursary.oyostate.gov.ng/2026/, the official application form https://app.bursary.oyostate.gov.ng/bursary/apply, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10249. The official page states registration is open and closes Monday 2026-11-02 at 11:59 PM WAT. Eligibility: Oyo State indigene; final-year undergraduate, HND, NCE, final-year clinical, aviation or maritime student; Nigerian public institution; not private, part-time or overseas; final-year Law students excluded. The official application form additionally requires paid 2026 FOSSU membership and prohibits duplicate entries. Required documents are admission letter, local-government identification, current course-registration form endorsed by the Head of Department, passport photograph and proof of FOSSU membership. The official notice does not state an award amount or opening date. The profile does not track final-year status or FOSSU membership, so those must be checked manually. The official form loaded at Step 1/5; no applicant data were entered or submitted.',
      'Review eligibility and prepare your admission letter, local-government identification, current course-registration form endorsed by your Head of Department, passport photograph and proof of FOSSU membership with 2026 dues paid. Apply through the official Oyo State portal before 2 November 2026 at 11:59 PM WAT. The form says private, part-time and overseas students are ineligible; applicants must be final-year students in an eligible programme, and final-year Law students are excluded. Do not submit duplicate entries. Save the application confirmation and number to check status.',
      null, now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Oyo State Scholarship Bursary Award 2026',
      provider_name = 'Oyo State Scholarship Board',
      description = 'Financial support for Oyo State indigenes in their final year at a Nigerian public tertiary institution. Eligible groups include final-year university undergraduates, HND and NCE students, final-year clinical students, and aviation or maritime students. Final-year Law students are excluded. Private-institution, part-time and overseas students are not eligible. Applicants must be FOSSU members and have paid their 2026 membership dues. The official notice does not state the bursary amount.',
      amount = 'Amount not stated by the official Oyo State notice',
      deadline = '2026-11-02',
      application_url = 'https://app.bursary.oyostate.gov.ng/bursary/apply',
      level = 'undergrad', discipline = 'All disciplines',
      research_notes = 'Verified 2026-10-15 against the official Oyo State 2025/2026 Bursary Award page https://bursary.oyostate.gov.ng/2026/, the official application form https://app.bursary.oyostate.gov.ng/bursary/apply, and supplied ScholarshipAir listing https://www.scholarshipair.com/s/10249. The official page states registration is open and closes Monday 2026-11-02 at 11:59 PM WAT. Eligibility: Oyo State indigene; final-year undergraduate, HND, NCE, final-year clinical, aviation or maritime student; Nigerian public institution; not private, part-time or overseas; final-year Law students excluded. The official application form additionally requires paid 2026 FOSSU membership and prohibits duplicate entries. Required documents are admission letter, local-government identification, current course-registration form endorsed by the Head of Department, passport photograph and proof of FOSSU membership. The official notice does not state an award amount or opening date. The profile does not track final-year status or FOSSU membership, so those must be checked manually. The official form loaded at Step 1/5; no applicant data were entered or submitted.',
      how_to_apply = 'Review eligibility and prepare your admission letter, local-government identification, current course-registration form endorsed by your Head of Department, passport photograph and proof of FOSSU membership with 2026 dues paid. Apply through the official Oyo State portal before 2 November 2026 at 11:59 PM WAT. The form says private, part-time and overseas students are ineligible; applicants must be final-year students in an eligible programme, and final-year Law students are excluded. Do not submit duplicate entries. Save the application confirmation and number to check status.',
      opens_at = null, last_verified_at = now()
    where id = v_id;
  end if;

  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_id and field = 'state_of_origin'
      and operator = 'eq' and value = '"Oyo"'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'state_of_origin', 'eq', '"Oyo"'::jsonb, true);
  end if;

  if not exists (
    select 1 from public.scholarship_rules
    where scholarship_id = v_id and field = 'institution_type'
      and operator = 'in'
      and value = '["federal_uni", "state_uni", "polytechnic", "college_of_education"]'::jsonb
    limit 1
  ) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'institution_type', 'in', '["federal_uni", "state_uni", "polytechnic", "college_of_education"]'::jsonb, true);
  end if;
end
$migration$;
