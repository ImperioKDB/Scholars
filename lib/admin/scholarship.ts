import { z } from "zod";
import { DISCIPLINE_OPTIONS, GENDER_OPTIONS, NIGERIAN_STATES, INSTITUTION_TYPE_OPTIONS } from "@/lib/profile";
import type { CompetitivenessTier } from "@/lib/matching/types";

export type ScholarshipLevel = "undergrad" | "postgrad" | "both";
export type RuleOperator = "eq" | "gte" | "lte" | "in" | "exists";

// Fields the matching engine (lib/matching/engine.ts) can actually verify
// and score against. Nigerian-undergrad-focused: location/identity fields
// (state & LGA of origin, age) and exam results (JAMB, WAEC) are now
// first-class matchable dimensions, not just GPA/discipline/nationality.
export const MATCHABLE_RULE_FIELDS = [
  { value: "discipline", label: "Field of study" },
  { value: "gpa", label: "GPA / CGPA" },
  { value: "nationality", label: "Nationality" },
  { value: "gender", label: "Gender" },
  { value: "financial_need", label: "Financial need" },
  { value: "age", label: "Age" },
  { value: "state_of_origin", label: "State of origin" },
  { value: "lga_of_origin", label: "LGA of origin" },
  { value: "year_of_study", label: "Year of study" },
  { value: "institution_type", label: "Institution type" },
  { value: "jamb_score", label: "JAMB / UTME score" },
  { value: "waec_credit_count", label: "WAEC/NECO credits" },
  { value: "has_english_maths_credit", label: "English & Maths credit" },
  { value: "disability_status", label: "Disability status" },
] as const;

export type MatchableField = (typeof MATCHABLE_RULE_FIELDS)[number]["value"];

// The full set the backend (app/api/admin/scholarships/**) will actually
// accept -- one field wider than MATCHABLE_RULE_FIELDS. career_goals is a
// valid rule target server-side, but the engine doesn't score it (free
// text), so a rule on it always shows as "unverifiable" to students rather
// than affecting their match score.
export const ADMIN_RULE_FIELDS = [
  ...MATCHABLE_RULE_FIELDS,
  { value: "career_goals", label: "Career goals (not auto-scored)" },
] as const;

const OPERATORS_BY_FIELD: Record<MatchableField | "career_goals", RuleOperator[]> = {
  discipline: ["eq", "in"],
  gpa: ["gte", "lte", "eq"],
  nationality: ["eq", "in"],
  gender: ["eq", "in"],
  financial_need: ["eq", "exists"],
  age: ["gte", "lte", "eq"],
  state_of_origin: ["eq", "in"],
  lga_of_origin: ["eq", "in"],
  year_of_study: ["gte", "lte", "eq"],
  institution_type: ["eq", "in"],
  jamb_score: ["gte", "lte"],
  waec_credit_count: ["gte", "lte"],
  has_english_maths_credit: ["eq", "exists"],
  disability_status: ["eq", "exists"],
  career_goals: ["exists", "eq"],
};

export function operatorsFor(field: string): RuleOperator[] {
  if (field in OPERATORS_BY_FIELD) return OPERATORS_BY_FIELD[field as MatchableField | "career_goals"];
  return ["eq", "gte", "lte", "in", "exists"];
}

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq: "is exactly",
  gte: "is at least",
  lte: "is at most",
  in: "is one of",
  exists: "must be provided",
};

export { DISCIPLINE_OPTIONS, GENDER_OPTIONS, NIGERIAN_STATES, INSTITUTION_TYPE_OPTIONS };

// Competitiveness tier options for the admin form's manual fallback field
// (used when awards_available/estimated_applicant_pool aren't known
// precisely). See migration: add_competitiveness_fields and
// lib/matching/engine.ts's computeCompetitivenessFactor.
export const COMPETITIVENESS_TIER_OPTIONS: { value: CompetitivenessTier; label: string }[] = [
  { value: "low", label: "Low -- wide open" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very high -- extremely oversubscribed" },
];

// -- Rule row (UI state, before serializing `value` to jsonb) --------------
export type RuleFormRow = {
  key: string; // client-only id for React list rendering
  id?: string; // real scholarship_rules.id once persisted; absent for new/unsaved rows
  field: string;
  operator: RuleOperator;
  value: string; // raw text input; parsed based on field/operator on submit
};

export function emptyRule(): RuleFormRow {
  return { key: crypto.randomUUID(), field: "discipline", operator: "eq", value: "" };
}

// The admin rules API only exposes POST (add one) and DELETE (remove one) --
// deliberately, per its own comments, to keep each write small and
// auditable rather than one call silently wiping and rebuilding a rule set.
// This computes what to POST/DELETE to reconcile the form state with what's
// actually persisted, treating an edited existing rule as delete-then-add.
export function diffRules(original: RuleFormRow[], current: RuleFormRow[]) {
  const originalById = new Map(original.filter((r) => r.id).map((r) => [r.id!, r]));
  const currentIds = new Set(current.filter((r) => r.id).map((r) => r.id!));

  const toDelete: string[] = [];
  for (const id of originalById.keys()) {
    if (!currentIds.has(id)) toDelete.push(id);
  }

  const toAdd: RuleFormRow[] = [];
  for (const row of current) {
    if (!row.id) {
      toAdd.push(row); // brand new row
      continue;
    }
    const orig = originalById.get(row.id);
    if (
      orig &&
      (orig.field !== row.field || orig.operator !== row.operator || orig.value !== row.value)
    ) {
      toDelete.push(row.id); // changed -- replace via delete + add
      toAdd.push(row);
    }
  }

  return { toDelete, toAdd };
}

const BOOLEAN_FIELDS = new Set(["financial_need", "has_english_maths_credit", "disability_status"]);
const NUMERIC_FIELDS = new Set(["gpa", "age", "year_of_study", "jamb_score", "waec_credit_count"]);

// Converts a rule row's raw text value into the JS value that should be sent
// to the jsonb `value` column, based on field + operator.
export function serializeRuleValue(field: string, operator: RuleOperator, raw: string): unknown {
  if (operator === "exists") return true;
  if (NUMERIC_FIELDS.has(field)) return Number(raw);
  if (BOOLEAN_FIELDS.has(field)) return raw === "true";
  if (operator === "in") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return raw.trim();
}

// Converts a jsonb `value` back into the raw text a rule row's input should
// show -- the inverse of serializeRuleValue, used when loading an existing
// scholarship into the edit form.
export function parseRuleValue(field: string, operator: RuleOperator, value: unknown): string {
  if (operator === "exists") return "";
  if (operator === "in" && Array.isArray(value)) return value.join(", ");
  if (BOOLEAN_FIELDS.has(field)) return String(Boolean(value));
  return String(value);
}

// how_to_apply: fallback guidance shown on the scholarship detail page and
// in Applications when application_url is blank (email-only application,
// no stable public portal, etc.) -- see migration:
// add_how_to_apply_fallback. Deliberately NOT required even when
// application_url is empty, since a scholarship can legitimately be saved
// as a draft (verified: false) before either is known.
//
// opens_at: date applications open, admin-set, optional. Blank/null means
// "no restriction" -- treated as already open. Feeds the "Open now" badge
// (lib/discovery.ts), never the eligibility score. See migration:
// add_opens_at_and_trending_fn.
//
// Competitiveness fields (awards_available, estimated_applicant_pool,
// competitiveness_tier, historical_acceptance_rate, competitiveness_notes)
// mirror the DB columns from migration: add_competitiveness_fields. Kept
// as raw strings here (like amount/application_url) rather than typed
// numbers -- the numeric conversion happens on submit in
// app/admin/scholarships/new/page.tsx and .../[id]/edit/page.tsx, same
// pattern the rest of this form already uses (e.g. RuleBuilder's numeric
// inputs via serializeRuleValue). All optional: a scholarship with no
// competitiveness research yet is unaffected by the matching engine, not
// blocked from saving.
export const scholarshipSchema = z.object({
  title: z.string().min(3, "Title is required."),
  provider_name: z.string().min(2, "Provider name is required."),
  description: z.string().optional(),
  amount: z.string().optional(),
  deadline: z.string().min(1, "Deadline is required."),
  opens_at: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  application_url: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), "Must be a full URL starting with http(s)://"),
  how_to_apply: z.string().max(2000, "Keep it under 2000 characters.").optional(),
  level: z.enum(["undergrad", "both"]),
  discipline: z.string().optional(),
  verified: z.boolean(),
  awards_available: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v.trim()) && Number(v) > 0), "Must be a positive whole number"),
  estimated_applicant_pool: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v.trim()) && Number(v) > 0), "Must be a positive whole number"),
  competitiveness_tier: z.union([z.enum(["low", "medium", "high", "very_high"]), z.literal("")]).optional(),
  historical_acceptance_rate: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 1), "Must be between 0 and 1"),
  competitiveness_notes: z.string().max(2000, "Keep it under 2000 characters.").optional(),
});

export type ScholarshipFormValues = z.infer<typeof scholarshipSchema>;

export const EMPTY_SCHOLARSHIP: ScholarshipFormValues = {
  title: "",
  provider_name: "",
  description: "",
  amount: "",
  deadline: "",
  opens_at: "",
  application_url: "",
  how_to_apply: "",
  level: "both",
  discipline: "",
  verified: false,
  awards_available: "",
  estimated_applicant_pool: "",
  competitiveness_tier: "",
  historical_acceptance_rate: "",
  competitiveness_notes: "",
};
