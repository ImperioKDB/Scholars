import type { InstitutionType, MatchableProfile } from "./types";

// lib/matching/profileMapper.ts
//
// Single profiles-row -> MatchableProfile projection. getMatches.ts
// previously inlined this exact 16-field object literal twice (once in
// getMatchesForCurrentUser, once in getMatchForScholarship); any future
// field added to MatchableProfile had to be remembered in both places.
// One function removes that drift risk. Pure projection, no DB access, no
// behavior change.
export type MatchableProfileSource = {
  discipline: string | null;
  gpa: number | null;
  nationality: string | null;
  gender: string | null;
  financial_need: boolean;
  date_of_birth: string | null;
  state_of_origin: string | null;
  lga_of_origin: string | null;
  year_of_study: number | null;
  institution_type: InstitutionType | null;
  jamb_score: number | null;
  waec_credit_count: number | null;
  has_english_maths_credit: boolean;
  disability_status: boolean;
  profile_completeness: number;
};

export function toMatchableProfile(p: MatchableProfileSource): MatchableProfile {
  return {
    discipline: p.discipline,
    gpa: p.gpa,
    nationality: p.nationality,
    gender: p.gender,
    financial_need: p.financial_need,
    date_of_birth: p.date_of_birth,
    state_of_origin: p.state_of_origin,
    lga_of_origin: p.lga_of_origin,
    year_of_study: p.year_of_study,
    institution_type: p.institution_type,
    jamb_score: p.jamb_score,
    waec_credit_count: p.waec_credit_count,
    has_english_maths_credit: p.has_english_maths_credit,
    disability_status: p.disability_status,
    profile_completeness: p.profile_completeness,
  };
}
