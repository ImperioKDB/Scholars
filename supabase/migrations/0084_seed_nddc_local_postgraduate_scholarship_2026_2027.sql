-- Publish the current NDDC Local Post-Graduate Scholarship after checking
-- the official NDDC homepage, scholarship listing, and application portal on
-- 2026-10-13. The checked official pages do not publish an award amount or
-- detailed eligibility rules, so those fields remain explicitly unclaimed.
do $migration$
begin
  if not exists (
    select 1
    from public.scholarships
    where application_url = 'https://scholarship.nddc.gov.ng/login'
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
      'NDDC Local Post-Graduate (Master''s Degree) Scholarship 2026/2027',
      'Niger Delta Development Commission (NDDC)',
      'A local postgraduate scholarship programme for the 2026/2027 academic session. The official NDDC homepage invites suitably qualified Niger Delta indigenes to apply for Master''s degree study through the Commission''s scholarship programme. The checked official pages do not publish the award amount or detailed eligibility requirements, so applicants must confirm those details in the official application process before applying.',
      'Not stated on the checked official pages',
      '2026-11-08',
      'https://scholarship.nddc.gov.ng/login',
      'postgrad',
      'Master''s degree programmes',
      true,
      'Verified 2026-10-13 against the official NDDC homepage https://nddc.gov.ng/, which identifies the 2026/2027 NDDC Local Post-Graduate (Master''s Degree) Scholarships and states an application deadline of 2026-11-08; the official scholarship listing https://www.nddc.gov.ng/WhatWeDo/Scholarship, which links to the application action; and the official portal https://scholarship.nddc.gov.ng/login. The checked pages do not state the award amount or detailed eligibility criteria. No unsupported amount or structured eligibility rule has been added.',
      'Review the requirements in the official NDDC scholarship application process and apply through the NDDC portal before 8 November 2026. Use only official NDDC channels and do not pay an intermediary for access or placement.',
      now()
    );
  end if;
end
$migration$;
