export type RuleOperator = "eq" | "gte" | "lte" | "in" | "exists";

export type ScholarshipRule = {
  id: string;
  scholarship_id: string;
  field: string;
  operator: RuleOperator;
  value: unknown;
};

export type InstitutionType =
  | "federal_uni"
  | "state_uni"
  | "private_uni"
  | "polytechnic"
  | "college_of_education";

// The subset of profiles columns (plus the derived `age` field) the engine
// knows how to evaluate. Anything outside this set is flagged as
// "unverifiable" rather than silently guessed at.
export type MatchableProfile = {
  discipline: string | null;
  gpa: number | null;
  nationality: string | null;
  gender: string | null;
  financial_need: boolean;
  date_of_birth: string | null; // ISO date; engine derives `age` from this
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

// Manual fallback competitiveness signal, used when awards_available /
// estimated_applicant_pool aren't both known precisely (see
// migration: add_competitiveness_fields).
export type CompetitivenessTier = "low" | "medium" | "high" | "very_high";

export type ScholarshipRow = {
  id: string;
  title: string;
  provider_name: string;
  description: string | null;
  amount: string | null;
  deadline: string | null;
  // Date applications open. Null = no restriction (open as soon as
  // verified). Distinct from deadline -- feeds the "Open now" badge, not
  // the matching/eligibility score. See migration:
  // add_opens_at_and_trending_fn and lib/discovery.ts.
  opens_at: string | null;
  application_url: string | null;
  // Fallback guidance shown in place of the "Apply" button when
  // application_url is null (e.g. email-only application, no stable
  // official portal found). See migration: add_how_to_apply_fallback.
  how_to_apply: string | null;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  verified: boolean;
  // Competitiveness inputs -- all admin-researched, all optional. Null
  // means "not researched yet," never treated as a worst case. See
  // migration: add_competitiveness_fields and engine.ts's
  // computeCompetitivenessFactor.
  awards_available: number | null;
  estimated_applicant_pool: number | null;
  competitiveness_tier: CompetitivenessTier | null;
  historical_acceptance_rate: number | null;
};

export type RuleStatus = "met" | "not_met" | "missing_data" | "unverifiable";

export type EvaluatedRequirement = {
  field: string;
  label: string;
  operator: RuleOperator;
  status: RuleStatus;
  requirement: string; // human-readable description of what's required
  detail: string; // human-readable status message, e.g. "Met (yours: 3.72)"
  gating: boolean;
};

export type MatchTier = "excellent" | "good" | "possible" | "unlikely";

export type ScholarshipMatch = ScholarshipRow & {
  // Combined score shown to students: eligibility discounted by
  // competitiveness (see engine.ts). This is what MatchSeal, tier
  // thresholds, and rankScore are based on -- "your realistic score,"
  // not just "did you meet the requirements."
  score: number; // 0-100
  // Pure eligibility score, unadjusted for competitiveness -- how many of
  // the checkable requirements you meet. Kept alongside `score` so the UI
  // can explain a gap between "you meet every requirement" and "but this
  // is very competitive."
  eligibilityScore: number; // 0-100
  // 0.5-1.0 multiplier applied to eligibilityScore to get score. 1.0 means
  // no competitiveness data or a wide-open award; never drops below 0.5 --
  // competitiveness makes a spot harder to win, it never makes an
  // eligible student "less eligible."
  competitivenessFactor: number;
  rankScore: number; // score blended with profile completeness, used for sort order
  tier: MatchTier;
  requirements: EvaluatedRequirement[];
  missingProfileFields: EvaluatedRequirement[]; // subset of requirements the profile is too thin to check
  unverifiable: EvaluatedRequirement[]; // requirements the engine can't check at all (not in schema)
};
