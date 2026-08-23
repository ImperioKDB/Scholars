import { z } from "zod";
import { DISCIPLINE_OPTIONS, GENDER_OPTIONS } from "@/lib/profile";

export type ScholarshipLevel = "undergrad" | "postgrad" | "both";
export type RuleOperator = "eq" | "gte" | "lte" | "in" | "exists";

// Fields the matching engine (lib/matching/engine.ts) can actually verify
// and score against.
export const MATCHABLE_RULE_FIELDS = [
  { value: "academic_level", label: "Academic level" },
  { value: "discipline", label: "Field of study" },
  { value: "gpa", label: "GPA / CGPA" },
  { value: "nationality", label: "Nationality" },
  { value: "gender", label: "Gender" },
  { value: "financial_need", label: "Financial need" },
] as const;

export type MatchableField = (typeof MATCHABLE_RULE_FIELDS)[number]["value"];

// The full set the backend (app/api/admin/scholarships/**) will actually
// accept — one field wider than MATCHABLE_RULE_FIELDS. career_goals is a
// valid rule target server-side, but the engine doesn't score it (it's
// free text, not something students fill in a comparable way), so a rule
// on it always shows as "unverifiable" to students rather than affecting
// their match score. There's no free-text "custom field" option anymore —
// the backend's zod schema rejects anything outside this enum with a 400.
export const ADMIN_RULE_FIELDS = [
  ...MATCHABLE_RULE_FIELDS,
  { value: "career_goals", label: "Career goals (not auto-scored)" },
] as const;

const OPERATORS_BY_FIELD: Record<MatchableField | "career_goals", RuleOperator[]> = {
  academic_level: ["eq"],
  discipline: ["eq", "in"],
  gpa: ["gte", "lte", "eq"],
  nationality: ["eq", "in"],
  gender: ["eq", "in"],
  financial_need: ["eq", "exists"],
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

export { DISCIPLINE_OPTIONS, GENDER_OPTIONS };

// ── Rule row (UI state, before serializing `value` to jsonb) ─────────────
export type RuleFormRow = {
  key: string; // client-only id for React list rendering
  id?: string; // real scholarship_rules.id once persisted; absent for new/unsaved rows
  field: string;
  operator: RuleOperator;
  value: string; // raw text input; parsed based on field/operator on submit
};

export function emptyRule(): RuleFormRow {
  return { key: crypto.randomUUID(), field: "academic_level", operator: "eq", value: "" };
}

// The admin rules API only exposes POST (add one) and DELETE (remove one) —
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
      toDelete.push(row.id); // changed — replace via delete + add
      toAdd.push(row);
    }
  }

  return { toDelete, toAdd };
}

// Converts a rule row's raw text value into the JS value that should be sent
// to the jsonb `value` column, based on field + operator.
export function serializeRuleValue(field: string, operator: RuleOperator, raw: string): unknown {
  if (operator === "exists") return true;
  if (field === "gpa") return Number(raw);
  if (field === "financial_need") return raw === "true";
  if (operator === "in") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return raw.trim();
}

// Converts a jsonb `value` back into the raw text a rule row's input should
// show — the inverse of serializeRuleValue, used when loading an existing
// scholarship into the edit form.
export function parseRuleValue(field: string, operator: RuleOperator, value: unknown): string {
  if (operator === "exists") return "";
  if (operator === "in" && Array.isArray(value)) return value.join(", ");
  if (field === "financial_need") return String(Boolean(value));
  return String(value);
}

export const scholarshipSchema = z.object({
  title: z.string().min(3, "Title is required."),
  provider_name: z.string().min(2, "Provider name is required."),
  description: z.string().optional(),
  amount: z.string().optional(),
  deadline: z.string().min(1, "Deadline is required."),
  application_url: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), "Must be a full URL starting with http(s)://"),
  level: z.enum(["undergrad", "postgrad", "both"]),
  discipline: z.string().optional(),
  verified: z.boolean(),
});

export type ScholarshipFormValues = z.infer<typeof scholarshipSchema>;

export const EMPTY_SCHOLARSHIP: ScholarshipFormValues = {
  title: "",
  provider_name: "",
  description: "",
  amount: "",
  deadline: "",
  application_url: "",
  level: "both",
  discipline: "",
  verified: false,
};
