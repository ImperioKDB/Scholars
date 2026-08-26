"use client";

import { Combobox } from "@/components/Combobox";
import { WAEC_SUBJECTS, WAEC_GRADES } from "@/lib/data/waec";
import { selectClass } from "@/components/FormField";

export type WaecRow = { key: string; subject: string; grade: string };

export function emptyWaecRow(): WaecRow {
  return { key: crypto.randomUUID(), subject: "", grade: "" };
}

const SUBJECT_OPTIONS = WAEC_SUBJECTS.map((s) => ({ value: s, label: s }));

// Row editor for WAEC/NECO/NABTEB subject + grade pairs. Deliberately does
// not ask a separate "do you have credit in English and Maths" question --
// that's derived automatically by the sync_waec_summary_fields() Postgres
// trigger from whatever's entered here (see migration: add_waec_results_table).
export function WaecResultsEditor({
  rows,
  onChange,
}: {
  rows: WaecRow[];
  onChange: (rows: WaecRow[]) => void;
}) {
  const usedSubjects = new Set(rows.map((r) => r.subject).filter(Boolean));

  function update(key: string, patch: Partial<WaecRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function remove(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  function add() {
    if (rows.length >= WAEC_SUBJECTS.length) return;
    onChange([...rows, emptyWaecRow()]);
  }

  return (
    <div>
      {rows.length === 0 && (
        <p className="text-sm text-navy-light mb-4">
          Add each subject from your WAEC (or NECO/NABTEB) result, with the grade you got.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const availableForThisRow = SUBJECT_OPTIONS.filter(
            (o) => o.value === row.subject || !usedSubjects.has(o.value)
          );
          return (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_140px_auto] gap-2 items-start bg-navy-50 rounded-lg p-3"
            >
              <Combobox
                options={availableForThisRow}
                value={row.subject}
                onChange={(value) => update(row.key, { subject: value })}
                placeholder="Search subject..."
              />
              <select
                className={selectClass}
                value={row.grade}
                onChange={(e) => update(row.key, { grade: e.target.value })}
              >
                <option value="">Grade</option>
                {WAEC_GRADES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(row.key)}
                className="text-rose text-sm font-medium px-2 py-2.5 hover:underline"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {rows.length < WAEC_SUBJECTS.length && (
        <button
          type="button"
          onClick={add}
          className="mt-3 text-sm font-medium text-navy hover:text-navy-light"
        >
          + Add subject
        </button>
      )}
    </div>
  );
}
