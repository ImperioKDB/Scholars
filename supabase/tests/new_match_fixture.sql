-- Extend the disposable deadline schema with the fields read by the match engine.
alter table public.profiles
  add discipline text, add gpa numeric, add nationality text, add gender text,
  add financial_need boolean default false, add date_of_birth date, add state_of_origin text,
  add lga_of_origin text, add year_of_study integer, add institution_type text, add jamb_score integer,
  add waec_credit_count integer, add has_english_maths_credit boolean default false,
  add disability_status boolean default false, add profile_completeness integer default 0;
alter table public.scholarships
  add provider_name text, add description text, add amount text, add how_to_apply text, add level text default 'both',
  add discipline text, add awards_available integer, add estimated_applicant_pool integer, add competitiveness_tier text,
  add historical_acceptance_rate numeric, add application_url text, add last_verified_at timestamptz;
create table public.scholarship_rules (
  id uuid primary key default gen_random_uuid(), scholarship_id uuid not null references public.scholarships,
  field text not null, operator text not null, value jsonb not null
);
