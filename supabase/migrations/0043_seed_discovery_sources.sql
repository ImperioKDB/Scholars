-- Initial reviewed source registry. All sources remain disabled until an administrator enables them.
insert into public.discovery_sources (name, base_url, source_type, trust_tier, enabled, crawl_policy)
values
  ('Federal Ministry of Education Scholarship Portal', 'https://scholarship.education.gov.ng/', 'official', 'primary', false, 'manual-review-first'),
  ('PTDF Scholarship Portal', 'https://scholarship.ptdf.gov.ng/', 'provider', 'primary', false, 'manual-review-first'),
  ('MTN Nigeria Scholarships', 'https://www.mtn.ng/scholarships/', 'provider', 'primary', false, 'manual-review-first'),
  ('ScholarshipAir Nigeria', 'https://www.scholarshipair.com/', 'secondary', 'review', false, 'manual-review-first')
on conflict (name) do nothing;
