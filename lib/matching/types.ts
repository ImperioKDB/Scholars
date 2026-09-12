import type { CyclePrediction } from "../cycles";
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
export type MatchableProfile = {
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
export type CompetitivenessTier = "low" | "medium" | "high" | "very_high";
export type ScholarshipRow = {
  id: string;
  title: string;
  provider_name: string;
  description: string | null;
  amount: string | null;
  deadline: string | null;
  opens_at: string | null;
  // Last confirmed date this scholarship's application window closed.
  // Used to distinguish "open by default" from "known closed, unknown reopen".
  last_cycle_closed_at: string | null;
  application_url: string | null;
  how_to_apply: string | null;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  verified: boolean;
  // Push C trust surface: when an admin last confirmed this listing as
  // live/accurate. Null = verified before migration 0021, or never verified.
  last_verified_at: string | null;
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
  requirement: string;
  detail: string;
  gating: boolean;
};
export type MatchTier = "excellent" | "good" | "possible" | "unlikely";
export type ScholarshipMatch = ScholarshipRow & {
  score: number;
  eligibilityScore: number;
  competitivenessFactor: number;
  rankScore: number;
  tier: MatchTier;
  requirements: EvaluatedRequirement[];
  missingProfileFields: EvaluatedRequirement[];
  unverifiable: EvaluatedRequirement[];
  // Phase 2 cycle intelligence: predicted next application window from
  // cycle_events history (lib/cycles.ts). Null when there is no history.
  cycle?: CyclePrediction | null;
};
