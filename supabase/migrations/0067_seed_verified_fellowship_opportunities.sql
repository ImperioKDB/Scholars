-- Publish two verified fellowship opportunities from official provider pages.
-- The Carewave URL supplied with this batch is a generic authenticated profile
-- portal, not a verifiable program application page, so it is intentionally omitted.

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
)
select
  'fellowship',
  '2027 Dalai Lama Fellows',
  'Dalai Lama Fellows',
  'A year-long contemplative leadership fellowship for young changemakers developing or launching social innovation projects. The program combines coaching, group learning, contemplative practice, and sustained work with a project and its community.',
  'Open worldwide to applicants aged 20–36 as of April 1, 2027. Applicants must demonstrate written and spoken English, meaningful knowledge of the community and issue their project addresses, an ongoing project or well-articulated plan, and the ability to participate throughout the fellowship year.',
  'Formal fellowship year: April 2027–March 2028; approximately 12 hours per month for fellowship participation, excluding project work.',
  'Global; virtual learning and coaching with ongoing engagement in the applicant’s project community.',
  null,
  'Social Innovation; Leadership; Community Development',
  '2026-11-11',
  '2026-10-01',
  'https://dalailamafellows.com/apply/',
  'Review the official eligibility requirements and submit the complete application, including the essays, video, resume/CV, and recommendation letter, by 22:00 UTC on November 11, 2026.',
  true,
  'Verified 2026-09-28 against the official application page: https://dalailamafellows.com/apply/. The official page states that the 2027 application opens 2026-10-01 and closes 2026-11-11 at 22:00 UTC. The application page is currently labelled “2027 Application Coming Soon.”'
where not exists (
  select 1 from public.opportunities
  where application_url = 'https://dalailamafellows.com/apply/'
);

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
)
select
  'fellowship',
  'Jim Leech Mastercard Foundation Fellowship on Entrepreneurship 2027',
  'Dunin-Deshpande Innovation Centre at Queen’s University / Mastercard Foundation',
  'An eight-month, fully virtual entrepreneurship fellowship for African students and recent graduates. Participants develop entrepreneurial skills and ventures through structured training, coaching, mentorship, networking, and milestone-based startup work.',
  'Open to students and recent graduates from all academic disciplines and post-secondary institutions in Africa. Applicants should be committed to developing an entrepreneurial mindset, ready to use the program’s resources and mentorship, and able to dedicate at least 10 hours per week. Program content is delivered in English; mentorship may also be available in French.',
  'Eight-month program delivered in three phases: Explore (January–February 2027), Ignite (March–April 2027), and Launch (May–August 2027).',
  'Fully virtual; open to eligible students and recent graduates across Africa.',
  'Up to 60 finalists may receive a CAD $500 stipend; finalists may also pitch for prizes of up to CAD $15,000.',
  'Entrepreneurship; Social Impact; Business Development',
  '2026-12-01',
  null,
  'https://queensu.qualtrics.com/jfe/form/SV_2skpzGTY6MedJJk',
  'Complete the official Queen’s University Qualtrics application before December 1, 2026 at 12:59 pm ET. Confirm the current eligibility criteria and program instructions on the form before applying.',
  true,
  'Verified 2026-09-28 against the official Queen’s University program page https://www.queensu.ca/innovationcentre/programs/jim-leech-mastercard-foundation-fellowship-entrepreneurship and the supplied official Qualtrics form https://queensu.qualtrics.com/jfe/form/SV_2skpzGTY6MedJJk. The form states the deadline is 2026-12-01 at 12:59 pm ET and describes the three program phases.'
where not exists (
  select 1 from public.opportunities
  where application_url = 'https://queensu.qualtrics.com/jfe/form/SV_2skpzGTY6MedJJk'
);
