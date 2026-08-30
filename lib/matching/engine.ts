import type {
  EvaluatedRequirement,
  MatchTier,
  MatchableProfile,
  RuleOperator,
  ScholarshipMatch,
  ScholarshipRow,
  ScholarshipRule,
} from "./types";

// Fields the engine can actually check against the profiles schema (plus
// the derived `age` field, computed from date_of_birth at evaluation time
// so it's never stale). A rule targeting anything else can't be verified
// and is surfaced as such rather than silently ignored or guessed.
const SUPPORTED_FIELDS = new Set([
  "discipline",
  "gpa",
  "nationality",
  "gender",
  "financial_need",
  "age",
  "state_of_origin",
  "lga_of_origin",
  "year_of_study",
  "institution_type",
  "jamb_score",
  "waec_credit_count",
  "has_english_maths_credit",
  "disability_status",
]);

// Fields where NOT meeting the requirement means the student is
// categorically ineligible (not just "less competitive"): citizenship,
// state/LGA-of-origin restrictions, age brackets, gender-restricted awards,
// discipline restrictions, and public-institution-only awards all behave
// this way. Numeric thresholds (GPA, JAMB, WAEC credits, year of study) stay
// non-gating so a near-miss still scores proportionally instead of being
// zeroed out.
const GATING_FIELDS = new Set([
  "discipline",
  "nationality",
  "gender",
  "state_of_origin",
  "lga_of_origin",
  "age",
  "institution_type",
]);

// Boolean fields with a real default (false) rather than "unset" -- missing
// data doesn't apply to these the way it does to nullable text/numeric
// fields.
const BOOLEAN_DEFAULT_FIELDS = new Set([
  "financial_need",
  "disability_status",
  "has_english_maths_credit",
]);

const FIELD_LABELS: Record<string, string> = {
  discipline: "Field of study",
  gpa: "GPA / CGPA",
  nationality: "Nationality",
  gender: "Gender",
  financial_need: "Financial need",
  age: "Age",
  state_of_origin: "State of origin",
  lga_of_origin: "LGA of origin",
  year_of_study: "Year of study",
  institution_type: "Institution type",
  jamb_score: "JAMB / UTME score",
  waec_credit_count: "WAEC/NECO credits",
  has_english_maths_credit: "English & Maths credit",
  disability_status: "Disability status",
};

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  federal_uni: "Federal University",
  state_uni: "State University",
  private_uni: "Private University",
  polytechnic: "Polytechnic / Monotechnic",
  college_of_education: "College of Education",
};

function label(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// Computes age in whole years as of today from an ISO date string.
function computeAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function displayValue(field: string, value: unknown): unknown {
  if (field === "institution_type" && typeof value === "string") {
    return INSTITUTION_TYPE_LABELS[value] ?? value;
  }
  return value;
}

function describeRequirement(field: string, operator: RuleOperator, value: unknown): string {
  const l = label(field);
  const displayed = displayValue(field, value);
  switch (operator) {
    case "eq":
      return `${l} must be ${displayed}`;
    case "gte":
      return `${l} of at least ${displayed}`;
    case "lte":
      return `${l} of at most ${displayed}`;
    case "in": {
      const arr = Array.isArray(value) ? value : [value];
      return `${l} must be one of: ${arr.map((v) => displayValue(field, v)).join(", ")}`;
    }
    case "exists":
      return `${l} must be provided`;
  }
}

function valuesMatch(a: unknown, b: unknown): boolean {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function evaluateOperator(
  operator: RuleOperator,
  profileValue: string | number | boolean,
  ruleValue: unknown
): boolean {
  switch (operator) {
    case "eq":
      if (typeof profileValue === "boolean") return profileValue === Boolean(ruleValue);
      return valuesMatch(profileValue, ruleValue);
    case "gte":
      return Number(profileValue) >= Number(ruleValue);
    case "lte":
      return Number(profileValue) <= Number(ruleValue);
    case "in": {
      const arr = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
      return arr.some((v) => valuesMatch(profileValue, v));
    }
    case "exists":
      return profileValue !== null && profileValue !== undefined && profileValue !== "";
  }
}

function evaluateRule(
  field: string,
  operator: RuleOperator,
  value: unknown,
  profile: MatchableProfile
): EvaluatedRequirement {
  const requirement = describeRequirement(field, operator, value);
  const gating = GATING_FIELDS.has(field);

  if (!SUPPORTED_FIELDS.has(field)) {
    return {
      field,
      label: label(field),
      operator,
      status: "unverifiable",
      requirement,
      detail: "Not tracked in your profile yet -- verify on the provider's page.",
      gating: false,
    };
  }

  // `age` isn't a stored column -- derive it from date_of_birth so it's
  // never stale, and treat a missing DOB the same as any other missing
  // required field.
  let profileValue: string | number | boolean | null;
  if (field === "age") {
    profileValue = profile.date_of_birth ? computeAge(profile.date_of_birth) : null;
  } else {
    profileValue = (profile as unknown as Record<string, string | number | boolean | null>)[field];
  }

  const isMissing =
    profileValue === null ||
    profileValue === undefined ||
    (typeof profileValue === "string" && profileValue.trim() === "");

  if (isMissing && !BOOLEAN_DEFAULT_FIELDS.has(field)) {
    return {
      field,
      label: label(field),
      operator,
      status: "missing_data",
      requirement,
      detail: `Add your ${label(field).toLowerCase()} to check this.`,
      gating,
    };
  }

  const met = evaluateOperator(operator, profileValue as string | number | boolean, value);
  const shownValue = displayValue(field, profileValue);

  return {
    field,
    label: label(field),
    operator,
    status: met ? "met" : "not_met",
    requirement,
    detail: met
      ? `Met${profileValue !== null && profileValue !== undefined ? ` (yours: ${shownValue})` : ""}`
      : `Not met${profileValue !== null && profileValue !== undefined ? ` (yours: ${shownValue})` : ""}`,
    gating,
  };
}

// scholarships.discipline is a first-class column (coarse filter), separate
// from the finer-grained scholarship_rules table. Fold it into the same
// evaluation so the UI shows one consistent list. `level` is no longer
// folded in here -- the platform is undergrad-only now, so postgrad-only
// scholarships are filtered out entirely before they reach the engine (see
// lib/matching/getMatches.ts), rather than being scored and gated.
function implicitRules(scholarship: ScholarshipRow): ScholarshipRule[] {
  const rules: ScholarshipRule[] = [];

  if (scholarship.discipline) {
    rules.push({
      id: `implicit-discipline-${scholarship.id}`,
      scholarship_id: scholarship.id,
      field: "discipline",
      operator: "eq",
      value: scholarship.discipline,
    });
  }

  return rules;
}

// Exported so lib/matching/gaps.ts can re-derive a hypothetical tier when
// simulating "what if this missing field were filled in" -- keeps the tier
// thresholds defined in exactly one place instead of being duplicated.
export function tierFor(score: number, gatingFailed: boolean): MatchTier {
  if (gatingFailed) return "unlikely";
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "possible";
  return "unlikely";
}

export function evaluateScholarship(
  profile: MatchableProfile,
  scholarship: ScholarshipRow,
  explicitRules: ScholarshipRule[]
): ScholarshipMatch {
  const allRules = [...implicitRules(scholarship), ...explicitRules];

  const requirements = allRules.map((r) => evaluateRule(r.field, r.operator, r.value, profile));

  const evaluable = requirements.filter((r) => r.status !== "unverifiable");
  const gatingFailed = requirements.some((r) => r.gating && r.status === "not_met");

  let score: number;
  if (evaluable.length === 0) {
    score = 50; // no rules defined yet to check against -- neutral, not zero
  } else {
    const metCount = evaluable.filter((r) => r.status === "met").length;
    score = Math.round((metCount / evaluable.length) * 100);
  }
  if (gatingFailed) score = Math.min(score, 15);

  const rankScore = Math.round(score * 0.85 + profile.profile_completeness * 0.15);

  return {
    ...scholarship,
    score,
    rankScore,
    tier: tierFor(score, gatingFailed),
    requirements,
    missingProfileFields: requirements.filter((r) => r.status === "missing_data"),
    unverifiable: requirements.filter((r) => r.status === "unverifiable"),
  };
}

export function rankScholarships(
  profile: MatchableProfile,
  scholarships: ScholarshipRow[],
  rulesByScholarship: Map<string, ScholarshipRule[]>
): ScholarshipMatch[] {
  return scholarships
    .map((s) => evaluateScholarship(profile, s, rulesByScholarship.get(s.id) ?? []))
    .sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
}
