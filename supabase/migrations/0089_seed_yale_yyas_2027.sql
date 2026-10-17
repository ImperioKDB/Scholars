-- Publish the verified Yale Young African Scholars 2027 fellowship opportunity.
-- Verified 2026-10-17 against Yale's official admissions, eligibility,
-- requirements, timeline, and program overview pages.
do $migration$
begin
  if not exists (
    select 1
    from public.opportunities
    where application_url = 'https://apply.globalscholars.yale.edu/apply/?sr=0d898c5f-198d-43dd-a47a-e261962b48b9'
       or lower(title) = lower('Yale Young African Scholars (YYAS) 2027')
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
      'fellowship',
      'Yale Young African Scholars (YYAS) 2027',
      'Yale Young African Scholars / Yale University',
      'An intensive academic and enrichment program for African secondary-school students preparing for tertiary education and leadership. The 2027 cycle offers a six-day online College Prep Workshop and a nine-day Residential Leadership Summit in Rwanda; students may attend only one session.',
      'Applicants must be 14–18 years old on 15 July 2027, be a citizen or permanent resident of an African country (refugees living in an African country may also apply), currently attend school in an African country, and be in Grade 10 or 11 or an international equivalent. Applicants must be able to participate in a rigorous English-language curriculum and must meet the applicable 2027 graduation-window requirements. Final-year secondary students, graduates, university students, and YYAS or YYGS alumni are not eligible.',
      'Online workshop: 15–20 July 2027 (6 days). Residential Leadership Summit in Rwanda: 7–15 August 2027 (9 days).',
      'Online worldwide across Africa; residential summit in Rwanda',
      'No tuition cost. The online workshop is free. The residential summit provides free housing, meals, and academic materials. Limited need-based travel grants may be available; applicants remain responsible for travel documentation and any travel costs not covered by a grant.',
      'Secondary education, university preparation, and leadership',
      '2026-10-20',
      null,
      'https://apply.globalscholars.yale.edu/apply/?sr=0d898c5f-198d-43dd-a47a-e261962b48b9',
      'Apply through Yale''s official application portal. Early Action applications are due by 11:59 PM Eastern Time on 20 October 2026. Regular Decision applications are due by 11:59 PM Eastern Time on 20 January 2027. Prepare the completed application with one 400-word essay and two short responses, extracurricular and school information, official secondary-school transcripts or grade reports, and one teacher recommendation submitted through Yale''s online recommendation form. Submit the application through the final Submit button. The application page is the authoritative source for the current form requirements.',
      true,
      'Verified 2026-10-17 against Yale Young African Scholars official admissions page https://africanscholars.yale.edu/admissions, eligibility page https://africanscholars.yale.edu/admissions/eligibility, requirements page https://africanscholars.yale.edu/admissions/application-requirements, timeline page https://africanscholars.yale.edu/admissions/application-timeline-deadlines, and program overview https://africanscholars.yale.edu/overview. The official pages confirm the 2027 program dates, Early Action deadline of 2026-10-20, Regular Decision deadline of 2027-01-20, eligibility requirements, required transcript and teacher recommendation, no minimum grade or standardized-test score requirement, tuition-free participation, residential housing/meals/materials, and limited need-based travel grants. The record uses the earlier Early Action deadline so the opportunity remains visible while that deadline is active; the Regular Decision deadline is retained in how_to_apply. This is a fellowship/program opportunity rather than a conventional university scholarship.'
    );
  end if;
end
$migration$;
