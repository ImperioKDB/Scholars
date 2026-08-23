"use client";

import {
  ADMIN_RULE_FIELDS,
  DISCIPLINE_OPTIONS,
  GENDER_OPTIONS,
  MATCHABLE_RULE_FIELDS,
  OPERATOR_LABELS,
  emptyRule,
  operatorsFor,
  type RuleFormRow,
  type RuleOperator,
} from "@/lib/admin/scholarship";
import { inputClass, selectClass } from "@/components/FormField";

const FIELD_OPTIONS = ADMIN_RULE_FIELDS;

function ValueInput({
  row,
  onChange,
}: {
  row: RuleFormRow;
  onChange: (value: string) => void;
}) {
  if (row.operator === "exists") {
    return <p className="text-xs text-navy-light py-2.5">No value needed — just checks the field is filled in.</p>;
  }

  if (row.field === "gpa") {
    return (
      <input
        className={inputClass}
        type="number"
        step="0.01"
        min="0"
        max="5"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="3.5"
      />
    );
  }

  if (row.field === "financial_need") {
    return (
      <select className={selectClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (row.field === "academic_level" && row.operator === "eq") {
    return (
      <select className={selectClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        <option value="undergrad">Undergraduate</option>
        <option value="postgrad">Postgraduate</option>
      </select>
    );
  }

  if (row.field === "discipline" && row.operator === "eq") {
    return (
      <select className={selectClass} value={row.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {DISCIPLINE_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
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

  if (row.operator === "in") {
    return (
      <input
        className={inputClass}
        type="text"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Comma-separated, e.g. STEM, Engineering"
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
          score for everyone — add at least one to make matching meaningful.
        </p>
      )}

      <div className="space-y-3">
        {rules.map((row) => {
          const isMatchable = MATCHABLE_RULE_FIELDS.some((f) => f.value === row.field);
          return (
            <div key={row.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start bg-navy-50 rounded-lg p-3">
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
                className="text-rose text-sm font-medium px-2 py-2.5 hover:underline"
              >
                Remove
              </button>

              {!isMatchable && (
                <p className="col-span-4 text-xs text-amber -mt-2">
                  Not tracked in student profiles, so this won&apos;t affect the match score —
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
