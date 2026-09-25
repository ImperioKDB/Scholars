-- Publish the verified International Youth Math Challenge qualification round.
-- The source URL contained an ambassador referral parameter; the public catalog
-- stores the canonical official submission URL and keeps the referral detail in
-- admin-only research notes.

insert into public.opportunities (
  type,
  title,
  provider_name,
  description,
  eligibility_notes,
  location,
  compensation,
  discipline,
  deadline,
  application_url,
  how_to_apply,
  verified,
  research_notes
)
select
  'competition',
  'International Youth Math Challenge — Qualification Round 2026',
  'International Youth Math Challenge (IYMC)',
  'An international online mathematics competition for students. Participants solve the official Qualification Round problem set and submit their solutions online for consideration in the next round.',
  'Open to students worldwide. IYMC groups participants as Junior, Youth, or Senior; the official problem sheet states that the qualification thresholds are 15, 17, and 20 points respectively.',
  'Online — worldwide',
  'Participation certificate; qualifying participants advance to the next round.',
  'Mathematics',
  '2026-09-27',
  'https://iymc.info/en/submission',
  'Download and solve the official Qualification Round 2026 problem sheet, then submit the solution through the IYMC submission form before the deadline.',
  true,
  'Verified 2026-09-25 against the official iymc.info submission page and the official Qualification Round 2026 PDF. The supplied URL included ambassador referral parameter amb=45667439.1788637806.7889.17789477; the public catalog intentionally stores the canonical URL without that tracking parameter.'
where not exists (
  select 1
  from public.opportunities
  where application_url = 'https://iymc.info/en/submission'
);
