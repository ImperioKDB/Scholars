-- Re-verified 2026-11-21 against Jim Ovia Foundation's current applicant page.
-- Update the existing unverified canonical record instead of creating a duplicate.
do $migration$
declare
  v_id uuid;
  v_title constant text := 'Jim Ovia Foundation Undergraduate Scholarship';
  v_url constant text := 'https://jimoviafoundation.org/jim-ovia-scholarship-application-new-applicants/';
  v_description constant text := 'The 2026 new-beneficiary cycle supports Nigerian citizens and residents from economically disadvantaged communities who are at least 16, have completed Senior Secondary School, have at least five O’Level credits, and have admission into a Nigerian state or federal university. The Foundation FAQ specifies full-time matriculated undergraduate students; postgraduate students are not eligible. No course restriction is stated. The award is ₦250,000 per year and may be renewed through the duration of study, but each renewal requires a fresh application and review and is not automatic. The Foundation FAQ states that 100 new awards are available each year.';
  v_amount constant text := '₦250,000 per year; renewal requires a fresh annual application and review';
  v_how_to_apply constant text := 'New applicants: review and apply through the official 2026 page at https://jimoviafoundation.org/jim-ovia-scholarship-application-new-applicants/. The Foundation lists the application window as 23–25 November 2026; follow the page’s application/account prompt when the cycle opens. Prepare documents using the official checklist at https://jimoviafoundation.org/list-of-documents-required-to-complete-an-application/. The application is online only, one submission is allowed per applicant, agents are prohibited, and there is no application fee. The Foundation checklist includes identity, birth, admission, academic, and O’Level records and a personal Zenith Bank account. Do not use the old 2025 application page, which is marked closed.';
  v_research_notes constant text := 'Verified 2026-11-21 against Jim Ovia Foundation’s official 2026 new-applicant page https://jimoviafoundation.org/jim-ovia-scholarship-application-new-applicants/. The page labels this the 2026 new-beneficiary cycle, says applications open Monday 23 November 2026 and close Wednesday 25 November 2026, and requires completed Senior Secondary School, admission into a Nigerian state or federal university with proof, at least five O’Level credits, and age 16 or older; it states there is no course restriction, no application fee, and no agents. The Foundation FAQ https://jimoviafoundation.org/faq/ says the programme is for Nigerian citizens/residents who are full-time matriculated undergraduate university students; postgraduate applicants are ineligible. The FAQ states an annual ₦250,000 award, renewable for up to the education tenure only after a fresh annual application and review, and 100 new awards per year. The official required-documents page https://jimoviafoundation.org/list-of-documents-required-to-complete-an-application/ includes admission and academic records, ID, birth certificate, passport photograph, O’Level certificate, and a personal Zenith Bank account. The user-provided 2025 page https://jimoviafoundation.org/2025-jim-ovia-scholarship-application-new-applicants/ says the 2025 cycle is closed. The homepage https://jimoviafoundation.org/home/ and login page still show a stale 2025-closed banner, while the separate 2026 applicant page gives the upcoming 23–25 November 2026 dates; use the 2026 applicant page as the current-cycle source. ScholarshipAir’s 2026 listing https://www.scholarshipair.com/scholarships/jim-ovia-foundation-undergraduate-scholarship-2026, published 2026-11-06, independently says the cycle is opening soon and reports ₦250,000, but leaves the deadline unspecified. The old database claim of full tuition and a 2027-11-28 deadline was not supported by current official sources and is replaced.';
begin
  select id into v_id
  from public.scholarships
  where application_url = v_url
     or (lower(provider_name) = lower('Jim Ovia Foundation')
         and lower(title) = lower(v_title))
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into public.scholarships (
      title, provider_name, description, amount, deadline, application_url,
      level, discipline, verified, research_notes, how_to_apply,
      awards_available, opens_at, last_cycle_closed_at, last_verified_at
    ) values (
      v_title,
      'Jim Ovia Foundation',
      v_description,
      v_amount,
      '2026-11-25',
      v_url,
      'undergrad',
      'All fields of study',
      true,
      v_research_notes,
      v_how_to_apply,
      100,
      '2026-11-23',
      null,
      now()
    ) returning id into v_id;
  else
    update public.scholarships set
      title = v_title,
      provider_name = 'Jim Ovia Foundation',
      description = v_description,
      amount = v_amount,
      deadline = '2026-11-25',
      application_url = v_url,
      level = 'undergrad',
      discipline = 'All fields of study',
      verified = true,
      research_notes = v_research_notes,
      how_to_apply = v_how_to_apply,
      awards_available = 100,
      opens_at = '2026-11-23',
      last_cycle_closed_at = null,
      last_verified_at = now()
    where id = v_id;
  end if;
end
$migration$;
