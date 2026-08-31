-- Fix: internal research/verification notes (confidence level, source,
-- last-checked date) had been leaked into the public-facing `description`
-- column across most of the seed data -- 42 of ~44 scholarship rows.
-- Applied live via Supabase MCP. This file is a reference record only,
-- per project convention -- do not re-run against the live project.
--
-- What this migration did:
--   1. Added `scholarships.research_notes` (text, admin-only) and
--      backfilled it with the full original (contaminated) description
--      for every affected row -- nothing was deleted, only relocated.
--   2. Rewrote `description` for 38 rows to keep the real eligibility
--      facts and drop only the meta-commentary (confidence labels,
--      "verified via web search", source-count claims).
--   3. Left 4 rows untouched by design -- their descriptions flagged the
--      scholarship as possibly non-existent ("LOW CONFIDENCE... may be
--      inaccurate"), which is real signal, not noise. All 4 were already
--      verified = false.
--   4. Found "Guinness Nigeria Scholarship Scheme" verified = true with a
--      fabricated placeholder deadline (2027-06-30) its own research
--      notes admitted was never confirmed. Set verified = false. Left
--      description untouched -- needs real data from an admin, not more
--      guessed copy.
--   5. Added the four representable eligibility rules to the NNPC/Seplat
--      JV scholarship (year_of_study >= 200, institution_type in
--      federal/state, gpa >= 3.5, waec_credit_count >= 5). Two
--      requirements from its original description have no home in the
--      current schema and were NOT faked into a rule row:
--        - "must not hold another concurrent scholarship" -- no
--          matchable field exists for this.
--        - the approved-course-list restriction was ALREADY present as
--          an explicit `discipline in [...]` rule on this row before this
--          migration ran -- not added by this migration, just confirmed
--          present.
--
-- research_notes is intentionally excluded from every public API select
-- list (see app/api/scholarships/**, app/api/scholarships/[id]/**) --
-- verify this stays true if those routes are ever refactored to `select *`.

alter table scholarships add column if not exists research_notes text;

comment on column scholarships.research_notes is
  'Internal research/verification notes (confidence level, source, last-checked date). Admin-only -- never include in public API select lists.';
