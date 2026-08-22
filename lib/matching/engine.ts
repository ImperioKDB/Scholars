import type {
  EvaluatedRequirement,
  MatchTier,
  MatchableProfile,
  RuleOperator,
  ScholarshipMatch,
  ScholarshipRow,
  ScholarshipRule,
} from "./types";

// Fields the engine can actually check against the profiles schema.
// A rule targeting anything else can't be verified and is surfaced as such
// rather than silently ignored or guessed.
const SUPPORTED_FIELDS = new Set([
  "academic_level",
  "discipline",
  "gpa",
  "nationality",
  "gender",
  "financial_need",
]);

// Fields where NOT meeting the requirement means the student is categorically
// ineligible (not just "less competitive") — citizenship, degree level,
// gender-restricted awards, and discipline restrictions all behave this way.
const GATING_FIELDS = new Set(["academic_level", "discipline", "nationality", "gender"]);

const FIELD_LABELS: Record<string, string> = {
  academic_level: "Academic level",
  discipline: "Field of study",
  gpa: "GPA / CGPA",
  nationality: "Nationality",
  gender: "Gender",
  financial_need: "Financial need",
};

function label(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function describeRequirement(field: string, operator: RuleOperator, value: unknown): string {
  const l = label(field);
  switch (operator) {
    case "eq":
      return `${l} must be ${value}`;
    case "gte":
      return `${l} of at least ${value}`;
    case "lte":
      return `${l} of at most ${value}`;
    case "in": {
      const arr = Array.isArray(value) ? value : [value];
      return `${l} must be one of: ${arr.join(", ")}`;
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
      detail: "Not tracked in your profile yet — verify on the provider's page.",
      gating: false,
    };
  }

  const profileValue = (profile as unknown as Record<string, string | number | boolean | null>)[
    field
  ];

  const isMissing =
    profileValue === null ||
    profileValue === undefined ||
    (typeof profileValue === "string" && profileValue.trim() === "");

  // financial_need is a boolean with a real default (false), so "missing"
  // doesn't apply to it the way it does to nullable text/numeric fields.
  if (isMissing && field !== "financial_need") {
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

  return {
    field,
    label: label(field),
    operator,
    status: met ? "met" : "not_met",
    requirement,
    detail: met
      ? `Met${profileValue !== null && profileValue !== undefined ? ` (yours: ${profileValue})` : ""}`
      : `Not met${profileValue !== null && profileValue !== undefined ? ` (yours: ${profileValue})` : ""}`,
    gating,
  };
}

// scholarships.level and scholarships.discipline are first-class columns
// (coarse filters), separate from the finer-grained scholarship_rules table.
// Fold them into the same evaluation so the UI shows one consistent list.
function implicitRules(scholarship: ScholarshipRow): ScholarshipRule[] {
  const rules: ScholarshipRule[] = [];

  if (scholarship.level !== "both") {
    rules.push({
      id: `implicit-level-${scholarship.id}`,
      scholarship_id: scholarship.id,
      field: "academic_level",
      operator: "eq",
      value: scholarship.level,
    });
  }

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

function tierFor(score: number, gatingFailed: boolean): MatchTier {
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
    score = 50; // no rules defined yet to check against — neutral, not zero
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
