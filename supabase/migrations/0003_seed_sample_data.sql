-- OPTIONAL — dev/testing only. Not required for the app to function.
-- Unlike 0001_init.sql, this one only touches scholarships/scholarship_rules
-- columns that match the live schema, so it's still safe to run as-is.
-- Seeds a handful of scholarships + rules so you can see the matching engine
-- produce real, varied scores before the Admin panel is built.
-- Safe to delete these rows later once you're adding real scholarships.
-- Run manually in the Supabase SQL editor, same as 0001_init.sql.

with s1 as (
  insert into scholarships (title, provider_name, description, amount, deadline, application_url, level, discipline, verified)
  values (
    'MTN Foundation Science & Technology Scholarship',
    'MTN Foundation',
    'Supports outstanding Nigerian undergraduates in STEM fields.',
    '₦300,000 + Mentorship',
    '2026-09-12',
    'https://example.com/apply/mtn',
    'undergrad',
    'STEM',
    true
  ) returning id
),
s2 as (
  insert into scholarships (title, provider_name, description, amount, deadline, application_url, level, discipline, verified)
  values (
    'Dangote Postgraduate Scholarship',
    'Dangote Foundation',
    'Funds Nigerian postgraduate students in Business-related disciplines.',
    '₦750,000',
    '2026-10-15',
    'https://example.com/apply/dangote',
    'postgrad',
    'Business',
    true
  ) returning id
),
s3 as (
  insert into scholarships (title, provider_name, description, amount, deadline, application_url, level, discipline, verified)
  values (
    'Chevron Scholarship for African Women',
    'Chevron',
    'Supports women in STEM across Africa, with a focus on financial need.',
    '₦350,000',
    '2026-10-20',
    'https://example.com/apply/chevron',
    'undergrad',
    'STEM',
    true
  ) returning id
),
s4 as (
  insert into scholarships (title, provider_name, description, amount, deadline, application_url, level, discipline, verified)
  values (
    'NNPC/Chevron Joint Venture Scholarship',
    'NNPC',
    'Open to undergraduates in Petroleum Engineering, no financial-need requirement.',
    '₦400,000',
    '2026-11-05',
    'https://example.com/apply/nnpc',
    'undergrad',
    'Engineering',
    true
  ) returning id
)
insert into scholarship_rules (scholarship_id, field, operator, value)
select id, 'nationality', 'eq', '"Nigerian"' from s1
union all
select id, 'gpa', 'gte', '3.5' from s1
union all
select id, 'academic_level', 'eq', '"undergrad"' from s1
union all
select id, 'leadership_experience', 'exists', 'true' from s1  -- deliberately unverifiable: not in profiles schema
union all
select id, 'nationality', 'eq', '"Nigerian"' from s2
union all
select id, 'gpa', 'gte', '3.0' from s2
union all
select id, 'nationality', 'eq', '"Nigerian"' from s3
union all
select id, 'gender', 'eq', '"Female"' from s3
union all
select id, 'financial_need', 'eq', 'true' from s3
union all
select id, 'gpa', 'gte', '2.5' from s4;
