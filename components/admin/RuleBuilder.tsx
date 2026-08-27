"use client";

import {
  ADMIN_RULE_FIELDS,
  DISCIPLINE_OPTIONS,
  GENDER_OPTIONS,
  NIGERIAN_STATES,
  INSTITUTION_TYPE_OPTIONS,
  MATCHABLE_RULE_FIELDS,
  OPERATOR_LABELS,
  emptyRule,
  operatorsFor,
  type RuleFormRow,
  type RuleOperator,
} from "@/lib/admin/scholarship";
import { inputClass, selectClass } from "@/components/FormField";
import { Combobox } from "@/components/Combobox";

const FIELD_OPTIONS = ADMIN_RULE_FIELDS;

const YES_NO_FIELDS = new Set(["financial_need", "has_english_maths_credit", "disability_status"]);
const NUMERIC_FIELDS = new Set(["gpa", "age", "year_of_study", "jamb_score", "waec_credit_count"]);

// Same source list as the student-facing discipline field (lib/profile.ts,
// sourced from lib/data/courses.ts) -- keeping both in sync matters because
// discipline is a gating field in the matching engine, so a typo'd or
// differently-cased scholarship discipline could silently exclude every
// otherwise-eligible student.
const DISCIPLINE_COMBO_OPTIONS = DISCIPLINE_OPTIONS.map((d) => ({ value: d, label: d }));

function ValueInput({
  row,
  onChange,
}: {
  row: RuleFormRow;
  onChange: (value: string) => void;
}) {
  if (row.operator === "exists") {
    return <p className="text-xs text-navy-light py-2.5">No value needed -- just checks the field is filled in.</p>;
  }

  if (NUMERIC_FIELDS.has(row.field)) {
    return (
      <input
        className={inputClass}
        type="number"
        step={row.field === "gpa" ? "0.01" : "1"}
        min="0"
        max={row.field === "gpa" ? "5" : row.field === "jamb_score" ? "400" : undefined}
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={row.field === "gpa" ? "3.5" : row.field === "age" ? "25" : ""}
      />
    );
  }

  if (YES_NO_FIELDS.has(row.field)) {
    return (
      <select className={selectClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (row.field === "discipline" && row.operator === "eq") {
    return (
      <Combobox
        options={DISCIPLINE_COMBO_OPTIONS}
        value={row.value}
        onChange={onChange}
        placeholder="Search a course"
      />
    );
  }

  if (row.field === "gender" && row.operator === "eq") {
    return (
      <select className={selectClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {GENDER_OPTIONS.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    );
  }

  if (row.field === "state_of_origin" && row.operator === "eq") {
    return (
      <select className={selectClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {NIGERIAN_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  }

  if (row.field === "institution_type" && row.operator === "eq") {
    return (
      <select className={selectClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {INSTITUTION_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (row.operator === "in") {
    return (
      <input
        className={inputClass}
        type="text"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Comma-separated, e.g. Lagos, Ogun, Oyo"
      />
    );
  }

  return (
    <input
      className={inputClass}
      type="text"
      value={row.value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
    />
  );
}

export function RuleBuilder({
  rules,
  onChange,
}: {
  rules: RuleFormRow[];
  onChange: (rules: RuleFormRow[]) => void;
}) {
  function update(key: string, patch: Partial<RuleFormRow>) {
    onChange(rules.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function updateField(key: string, field: string) {
    const validOps = operatorsFor(field);
    update(key, { field, operator: validOps[0], value: "" });
  }

  function remove(key: string) {
    onChange(rules.filter((r) => r.key !== key));
  }

  function add() {
    onChange([...rules, emptyRule()]);
  }

  return (
    <div>
      {rules.length === 0 && (
        <p className="text-sm text-navy-light mb-4">
          No eligibility rules yet. Without rules, this scholarship gets a neutral 50% match
          score for everyone -- add at least one to make matching meaningful.
        </p>
      )}

      <div className="space-y-3">
        {rules.map((row) => {
          const isMatchable = MATCHABLE_RULE_FIELDS.some((f) => f.value === row.field);
          return (
            <div
              key={row.key}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-start bg-navy-50 rounded-lg p-3"
            >
              <select
                className={selectClass}
                value={row.field}
                onChange={(e) => updateField(row.key, e.target.value)}
              >
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                className={selectClass}
                value={row.operator}
                onChange={(e) => update(row.key, { operator: e.target.value as RuleOperator, value: "" })}
              >
                {operatorsFor(row.field).map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>

              <ValueInput row={row} onChange={(value) => update(row.key, { value })} />

              <button
                type="button"
                onClick={() => remove(row.key)}
                className="text-rose text-sm font-medium px-2 py-2.5 hover:underline sm:justify-self-start justify-self-end"
              >
                Remove
              </button>

              {!isMatchable && (
                <p className="col-span-1 sm:col-span-4 text-xs text-amber -mt-2">
                  Not tracked in student profiles, so this won&apos;t affect the match score --
                  it&apos;ll show as a requirement students must verify manually.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-3 text-sm font-medium text-navy hover:text-navy-light"
      >
        + Add requirement
      </button>
    </div>
  );
}
