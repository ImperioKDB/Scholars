-- Publish the Carewave ASPIRE Scholarship Programme after verification against
-- Care Wave Foundation's official website and supplied portal.

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
)
select
  'Carewave ASPIRE Scholarship Programme (CASP)',
  'Care Wave Foundation',
  'A merit- and need-based scholarship programme supporting academically outstanding Nigerian students from vulnerable or low-income communities who have secured admission into eligible tertiary institutions, with priority given to Federal Universities in Nigeria. Initial support covers one academic year and may be renewed based on academic performance and programme requirements.',
  null,
  null,
  'https://portal.carewavefoundation.org/auth/sign-in?redirect=/profile/my-profile?utm_source=chatgpt.com',
  'both',
  null,
  true,
  'Verified 2026-09-28 against the official Care Wave Foundation website https://www.carewavefoundation.org/ and contact page https://www.carewavefoundation.org/contact-us. The official website identifies Care Wave Foundation as a registered non-profit, describes educational support as a programme area, publishes the scholarship announcement “Carewave Foundation Expands Access to Tertiary Education Through New Scholarship Programme,” and links the portal under the organisation’s official domain. The supplied portal is an authenticated application/profile portal; no fixed deadline or award amount was published in the checked official materials.',
  'Review the eligibility requirements and prepare academic, admission, and personal documents. Apply through the official Care Wave Foundation portal; do not pay any application fee or send credentials outside the official carewavefoundation.org domains.',
  '2026-09-01',
  now()
where not exists (
  select 1 from public.scholarships
  where application_url = 'https://portal.carewavefoundation.org/auth/sign-in?redirect=/profile/my-profile?utm_source=chatgpt.com'
);
