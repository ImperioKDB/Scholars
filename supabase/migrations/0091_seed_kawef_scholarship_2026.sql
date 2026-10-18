-- Publish the verified Kunle Ade Wahab Educational Foundation scholarship.
-- Verified 2026-10-18 against the official Lagos State University announcement
-- and the supplied Icanstudent listing.
do $migration$
declare
  v_id uuid;
begin
  select id into v_id
  from public.scholarships
  where application_url = 'mailto:kawefscholarship@gmail.com'
     or lower(title) = lower('Kunle Ade Wahab Educational Foundation Scholarship 2026')
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      opens_at, awards_available, last_verified_at
    ) values (
      'Kunle Ade Wahab Educational Foundation Scholarship 2026',
      'Kunle Ade Wahab Educational Foundation (KAWEF)',
      'The KAWEF 2026 scholarship provides full educational support to a minimum of 10 selected undergraduate students from eligible Ikorodu Division communities in Lagos State. Support includes tuition, books and study materials, accommodation, living expenses, and mentorship. The official announcement does not publish a cash award amount.',
      'Full educational support; minimum 10 scholarships',
      '2026-11-30',
      'mailto:kawefscholarship@gmail.com',
      'undergrad',
      null,
      true,
      'Verified 2026-10-18 against the official Lagos State University announcement on X https://x.com/LASUOfficial/status/2110822983698985118 and Facebook https://www.facebook.com/lasuinfo/posts/professor-kunle-ade-wahab-educational-foundation-kawef-opens-applications-for-20/ plus the supplied Icanstudent listing https://www.icanstudent.com/kunle-ade-wahab-educational-foundation-scholarship-2026-for-nigerian-undergraduates/. The official LASU announcement confirms the 30 November 2026 deadline, a minimum of 10 scholarships, eligibility for Years 3–5 students at LASU, OAU, Caleb University, or LASUSTECH Ikorodu, the five eligible degree programmes, and the six eligible Ikorodu Division LCDAs. The official announcement instructs applicants to submit by email to kawefscholarship@gmail.com and lists 0802 314 8777 as a WhatsApp-only enquiry contact. The aggregator additionally describes tuition, books, accommodation, living expenses, and mentorship as covered support; no monetary award amount is published by the official announcement.',
      'Email your application to kawefscholarship@gmail.com on or before 30 November 2026. The official LASU announcement lists 0802 314 8777 for WhatsApp-only enquiries. Prepare your academic records or transcript, admission letter, school ID card, personal statement or SOP, Local Government identification or indigene certificate, and a letter from a traditional ruler. Applicants must be Nigerian citizens and indigenes of one of these Ikorodu Division LCDAs: Ikorodu Central, Ikorodu North, Ikorodu West, Igbogbo-Baiyeku, Ijede, or Imota. You must be in Year 3, 4, or 5 at LASU, OAU, Caleb University, or LASUSTECH Ikorodu and study Architecture, Building Technology, Quantity Surveying, Estate Management, or Civil Engineering. Confirm the current document format and submission instructions with the foundation before sending sensitive documents.',
      null,
      10,
      now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = 'Kunle Ade Wahab Educational Foundation Scholarship 2026',
      provider_name = 'Kunle Ade Wahab Educational Foundation (KAWEF)',
      description = 'The KAWEF 2026 scholarship provides full educational support to a minimum of 10 selected undergraduate students from eligible Ikorodu Division communities in Lagos State. Support includes tuition, books and study materials, accommodation, living expenses, and mentorship. The official announcement does not publish a cash award amount.',
      amount = 'Full educational support; minimum 10 scholarships',
      deadline = '2026-11-30',
      application_url = 'mailto:kawefscholarship@gmail.com',
      level = 'undergrad',
      discipline = null,
      verified = true,
      research_notes = 'Verified 2026-10-18 against the official Lagos State University announcement on X https://x.com/LASUOfficial/status/2110822983698985118 and Facebook https://www.facebook.com/lasuinfo/posts/professor-kunle-ade-wahab-educational-foundation-kawef-opens-applications-for-20/ plus the supplied Icanstudent listing https://www.icanstudent.com/kunle-ade-wahab-educational-foundation-scholarship-2026-for-nigerian-undergraduates/. The official LASU announcement confirms the 30 November 2026 deadline, a minimum of 10 scholarships, eligibility for Years 3–5 students at LASU, OAU, Caleb University, or LASUSTECH Ikorodu, the five eligible degree programmes, and the six eligible Ikorodu Division LCDAs. The official announcement instructs applicants to submit by email to kawefscholarship@gmail.com and lists 0802 314 8777 as a WhatsApp-only enquiry contact. The aggregator additionally describes tuition, books, accommodation, living expenses, and mentorship as covered support; no monetary award amount is published by the official announcement.',
      how_to_apply = 'Email your application to kawefscholarship@gmail.com on or before 30 November 2026. The official LASU announcement lists 0802 314 8777 for WhatsApp-only enquiries. Prepare your academic records or transcript, admission letter, school ID card, personal statement or SOP, Local Government identification or indigene certificate, and a letter from a traditional ruler. Applicants must be Nigerian citizens and indigenes of one of these Ikorodu Division LCDAs: Ikorodu Central, Ikorodu North, Ikorodu West, Igbogbo-Baiyeku, Ijede, or Imota. You must be in Year 3, 4, or 5 at LASU, OAU, Caleb University, or LASUSTECH Ikorodu and study Architecture, Building Technology, Quantity Surveying, Estate Management, or Civil Engineering. Confirm the current document format and submission instructions with the foundation before sending sensitive documents.',
      awards_available = 10,
      opens_at = null,
      last_verified_at = now()
    where id = v_id;
  end if;

  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'nationality' and operator = 'eq' and value = '"Nigerian"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'nationality', 'eq', '"Nigerian"'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'state_of_origin' and operator = 'eq' and value = '"Lagos"'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'state_of_origin', 'eq', '"Lagos"'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'year_of_study' and operator = 'gte' and value = '300'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'year_of_study', 'gte', '300'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'year_of_study' and operator = 'lte' and value = '500'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'year_of_study', 'lte', '500'::jsonb, true);
  end if;
  if not exists (select 1 from public.scholarship_rules where scholarship_id = v_id and field = 'discipline' and operator = 'in' and value = '["Architecture", "Building Technology", "Quantity Surveying", "Estate Management", "Civil Engineering"]'::jsonb limit 1) then
    insert into public.scholarship_rules (scholarship_id, field, operator, value, gating)
    values (v_id, 'discipline', 'in', '["Architecture", "Building Technology", "Quantity Surveying", "Estate Management", "Civil Engineering"]'::jsonb, true);
  end if;
end
$migration$;
