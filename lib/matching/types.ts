export type RuleOperator = "eq" | "gte" | "lte" | "in" | "exists";

export type ScholarshipRule = {
  id: string;
  scholarship_id: string;
  field: string;
  operator: RuleOperator;
  value: unknown;
};

// The subset of profiles columns the engine knows how to evaluate.
// Anything outside this set is flagged as "unverifiable" rather than
// silently guessed at.
export type MatchableProfile = {
  academic_level: "undergrad" | "postgrad" | null;
  discipline: string | null;
  gpa: number | null;
  nationality: string | null;
  gender: string | null;
  financial_need: boolean;
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
