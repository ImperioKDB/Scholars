"use client";

import { Combobox } from "@/components/Combobox";
import { WAEC_SUBJECTS, WAEC_GRADES } from "@/lib/data/waec";
import { selectClass } from "@/components/FormField";

export type WaecRow = { key: string; subject: string; grade: string };

export function emptyWaecRow(): WaecRow {
  return { key: crypto.randomUUID(), subject: "", grade: "" };
}

const SUBJECT_OPTIONS = WAEC_SUBJECTS.map((s) => ({ value: s, label: s }));

// AUDIT FIX (batch 5): the five subjects nearly every Nigerian
// scholarship gates on. Adding them one row at a time was the tedious
// part of onboarding step 2 -- one tap adds whichever are still missing.
const CORE_SUBJECTS = ["English Language", "Mathematics", "Biology", "Chemistry", "Physics"];

// Row editor for WAEC/NECO/NABTEB subject + grade pairs. Deliberately does
// not ask a separate "do you have credit in English and Maths" question --
// that's derived automatically by the sync_waec_summary_fields() Postgres
// trigger from whatever's entered here (see migration: add_waec_results_table).
//
// Layout note: each row stacks vertically on mobile (full-width subject
// Combobox, then grade + Remove below it) and only becomes a single
// 3-column row at the sm: breakpoint. A fixed 3-column grid on a narrow
// phone squeezes the Combobox into a sliver, and its dropdown -- sized to
// match that sliver -- ends up narrow and overlapping the other columns
// with truncated option text.
export function WaecResultsEditor({
  rows,
  onChange,
}: {
  rows: WaecRow[];
  onChange: (rows: WaecRow[]) => void;
}) {
  const usedSubjects = new Set(rows.map((r) => r.subject).filter(Boolean));
  const missingCore = CORE_SUBJECTS.filter((s) => !usedSubjects.has(s));

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

  function addCoreSubjects() {
    if (missingCore.length === 0) return;
    const capacity = WAEC_SUBJECTS.length - rows.length;
    const toAdd = missingCore.slice(0, capacity).map((subject) => ({
      key: crypto.randomUUID(),
      subject,
      grade: "",
    }));
    onChange([...rows, ...toAdd]);
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
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto] items-start bg-navy-50 rounded-lg p-3"
            >
              <Combobox
                options={availableForThisRow}
                value={row.subject}
                onChange={(value) => update(row.key, { subject: value })}
                placeholder="Search subject..."
              />
              <div className="grid grid-cols-[1fr_auto] gap-2 sm:contents">
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
                  className="text-rose text-sm font-medium px-2 py-2.5 hover:underline whitespace-nowrap"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {rows.length < WAEC_SUBJECTS.length && (
          <button
            type="button"
            onClick={add}
            className="text-sm font-medium text-navy hover:text-navy-light"
          >
            + Add subject
          </button>
        )}
        {missingCore.length > 0 && rows.length < WAEC_SUBJECTS.length && (
          <button
            type="button"
            onClick={addCoreSubjects}
            className="text-sm font-medium text-navy hover:text-navy-light"
          >
            + Add core subjects (English, Maths, Biology, Chemistry, Physics)
          </button>
        )}
      </div>
    </div>
  );
}
