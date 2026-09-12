"use client";
import { useEffect, useState } from "react";

type DriftItem = { table: string; missing: string[]; tableMissing: boolean };

// Fetches /api/admin/schema-check on mount and renders a dismissable
// banner when the live database is missing columns the code expects.
// Dismissal is per-session (sessionStorage) so the banner returns on
// the next visit if drift is still present.
const DISMISS_KEY = "scholars:schema_banner_dismissed";

export function SchemaCheckBanner() {
  const [drift, setDrift] = useState<DriftItem[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      // storage blocked: show banner anyway
    }
    let cancelled = false;
    fetch("/api/admin/schema-check")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        const d = (body?.drift ?? []) as DriftItem[];
        setDrift(d);
      })
      .catch(() => {
        // silent: banner is advisory, never blocks admin
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || drift.length === 0) return null;

  const totalMissing = drift.reduce((n, d) => n + d.missing.length, 0);
  const tablesMissing = drift.filter((d) => d.tableMissing).length;
  const columnsMissing = totalMissing - tablesMissing;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-4">
      <div className="bg-rose-light border border-rose/20 rounded-xl p-4 flex items-start gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose shrink-0 mt-0.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-rose mb-1">
            Database schema is out of sync with the deployed code
          </p>
          <p className="text-xs text-ink leading-relaxed mb-2">
            {tablesMissing > 0 && <>
              {tablesMissing} table{tablesMissing === 1 ? "" : "s"} missing
              {columnsMissing > 0 && " and "}.
            </>}
            {columnsMissing > 0 && <>
              {columnsMissing} column{columnsMissing === 1 ? "" : "s"} missing from live tables.
            </>}
            {" "}Routes that read these will 500 until the migration runs.
          </p>
          <details className="text-xs">
            <summary className="text-navy font-medium cursor-pointer hover:underline">
              Show details
            </summary>
            <ul className="mt-2 space-y-1 text-navy-light font-mono">
              {drift.map((d) => (
                <li key={d.table}>
                  <span className="text-ink">{d.table}</span>
                  {d.tableMissing ? (
                    <span className="text-rose"> (entire table missing)</span>
                  ) : (
                    <>
                      {" "}&rarr; missing: {d.missing.join(", ")}
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-navy-light text-xs">
              Run the relevant migrations in{" "}
              <code className="bg-white px-1.5 py-0.5 rounded text-ink">supabase/migrations/</code>{" "}
              via the Supabase SQL editor, then refresh.
            </p>
          </details>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-navy-light hover:text-navy p-1"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
