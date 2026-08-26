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

export type ScholarshipRow = {
  id: string;
  title: string;
  provider_name: string;
  description: string | null;
  amount: string | null;
  deadline: string | null;
  application_url: string | null;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  verified: boolean;
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
  score: number; // 0-100, pure eligibility score
  rankScore: number; // score blended with profile completeness, used for sort order
  tier: MatchTier;
  requirements: EvaluatedRequirement[];
  missingProfileFields: EvaluatedRequirement[]; // subset of requirements the profile is too thin to check
  unverifiable: EvaluatedRequirement[]; // requirements the engine can't check at all (not in schema)
};
