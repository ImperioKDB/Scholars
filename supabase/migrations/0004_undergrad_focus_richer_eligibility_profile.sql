-- Pivot: platform is now Nigerian-undergraduate-only.
-- Drops academic_level (no longer meaningful -- every user is undergrad).
-- Adds the structured eligibility fields real Nigerian scholarships actually
-- gate on (state/LGA of origin, age via DOB, JAMB/WAEC results, year of
-- study, institution type) plus a lightweight document-readiness checklist
-- (booleans only -- no file storage, Document Vault stays deferred).
--
-- NOTE: this migration was already applied directly to the live project via
-- Supabase MCP (per the project's established workflow -- live schema is
-- the source of truth, migration files here are reference-only). This file
-- exists so the repo history matches what's actually live. Do not re-apply.

create type institution_type as enum (
  'federal_uni',
  'state_uni',
  'private_uni',
  'polytechnic',
  'college_of_education'
);

alter table public.profiles
  drop column if exists academic_level,
  add column date_of_birth date,
  add column state_of_origin text,
  add column lga_of_origin text,
  add column year_of_study integer,
  add column institution_name text,
  add column institution_type institution_type,
  add column jamb_score integer,
  add column waec_credit_count integer,
  add column has_english_maths_credit boolean not null default false,
  add column disability_status boolean not null default false,
  add column has_valid_id boolean not null default false,
  add column has_transcript boolean not null default false,
  add column has_recommendation_letter boolean not null default false,
  add column has_personal_statement boolean not null default false,
  add column has_lga_certificate boolean not null default false,
  add constraint year_of_study_range check (year_of_study is null or year_of_study between 100 and 600),
  add constraint jamb_score_range check (jamb_score is null or jamb_score between 0 and 400),
  add constraint waec_credit_count_range check (waec_credit_count is null or waec_credit_count between 0 and 9);

drop type if exists academic_level;

create or replace function public.calculate_profile_completeness(p profiles)
returns integer
language plpgsql
immutable
set search_path = ''
as $function$
declare
  filled int := 0;
  total int := 13;
begin
  if p.full_name is not null and p.full_name <> '' then filled := filled + 1; end if;
  if p.discipline is not null and p.discipline <> '' then filled := filled + 1; end if;
  if p.gpa is not null then filled := filled + 1; end if;
  if p.nationality is not null and p.nationality <> '' then filled := filled + 1; end if;
  if p.financial_need is not null then filled := filled + 1; end if;
  if p.career_goals is not null and p.career_goals <> '' then filled := filled + 1; end if;
  if p.date_of_birth is not null then filled := filled + 1; end if;
  if p.state_of_origin is not null and p.state_of_origin <> '' then filled := filled + 1; end if;
  if p.lga_of_origin is not null and p.lga_of_origin <> '' then filled := filled + 1; end if;
  if p.year_of_study is not null then filled := filled + 1; end if;
  if p.institution_type is not null then filled := filled + 1; end if;
  if p.jamb_score is not null then filled := filled + 1; end if;
  if p.waec_credit_count is not null then filled := filled + 1; end if;

  return round((filled::numeric / total::numeric) * 100)::int;
end;
$function$;
