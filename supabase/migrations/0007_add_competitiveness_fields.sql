-- Competitiveness signals for scholarships, layered on top of (not
-- replacing) the existing pure-eligibility score in lib/matching/engine.ts.
--
-- All fields are nullable/optional by design -- a scholarship with no
-- competitiveness data researched yet is unaffected (engine treats it as
-- factor = 1.0, no penalty for missing data), same "never fake it" pattern
-- as research_notes (see 0006_fix_description_metadata_leak.sql).
--
-- competitiveness_notes mirrors research_notes: admin-only, sourcing/
-- reasoning for the numbers, never included in public API select lists.
--
-- APPLIED LIVE via Supabase MCP on 2026-09-01. This file is a reference
-- record only, per project convention -- do not re-run against the live
-- project.

create type competitiveness_tier as enum ('low', 'medium', 'high', 'very_high');

alter table public.scholarships
  add column awards_available integer,
  add column estimated_applicant_pool integer,
  add column competitiveness_tier competitiveness_tier,
  add column historical_acceptance_rate numeric(4,3),
  add column competitiveness_notes text,
  add constraint awards_available_positive check (awards_available is null or awards_available > 0),
  add constraint estimated_applicant_pool_positive check (estimated_applicant_pool is null or estimated_applicant_pool > 0),
  add constraint historical_acceptance_rate_range check (
    historical_acceptance_rate is null or (historical_acceptance_rate >= 0 and historical_acceptance_rate <= 1)
  );

comment on column public.scholarships.awards_available is 'Admin-researched slots per cycle. Null = unknown, not zero.';
comment on column public.scholarships.estimated_applicant_pool is 'Admin-researched estimate of applicant volume. Null = unknown.';
comment on column public.scholarships.competitiveness_tier is 'Manual fallback competitiveness signal when awards/pool numbers are not known precisely.';
comment on column public.scholarships.historical_acceptance_rate is 'Fraction 0-1 from past cycles if known. Most conservative signal wins when combined with tier/ratio.';
comment on column public.scholarships.competitiveness_notes is 'Admin sourcing/reasoning for competitiveness fields, mirrors research_notes -- admin-only, never in public API selects.';
