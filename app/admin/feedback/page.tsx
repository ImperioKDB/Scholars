"use client";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type FeedbackRow = {
  id: string;
  profile_id: string | null;
  category: "bug" | "feature" | "scholarship" | "other";
  message: string;
  contact_email: string | null;
  page_url: string | null;
  status: "open" | "resolved";
  resolved_at: string | null;
  created_at: string;
};

type Filter = "open" | "resolved" | "all";

const CATEGORY_LABELS: Record<FeedbackRow["category"], string> = {
  bug: "Bug",
  feature: "Feature",
  scholarship: "Scholarship",
  other: "Other",
};

const CATEGORY_TONE: Record<FeedbackRow["category"], string> = {
  bug: "bg-rose-light text-rose",
  feature: "bg-navy-50 text-navy",
  scholarship: "bg-amber-light text-amber",
  other: "bg-hairline text-navy-light",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/feedback");
      if (res.status === 403) {
        setLoadError("Admin access required.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoadError("Couldn't load feedback.");
        setLoading(false);
        return;
      }
      const { feedback } = await res.json();
      setRows((feedback ?? []) as FeedbackRow[]);
    } catch {
      setLoadError("Network error. Check your connection and try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "open") return rows.filter((r) => r.status === "open");
    if (filter === "resolved") return rows.filter((r) => r.status === "resolved");
    return rows;
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { open: 0, resolved: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  async function toggleStatus(row: FeedbackRow) {
    const next: "open" | "resolved" = row.status === "open" ? "resolved" : "open";
    setPendingIds((p) => new Set(p).add(row.id));
    const prev = rows;
    setRows((cur) =>
      cur.map((r) =>
        r.id === row.id
          ? { ...r, status: next, resolved_at: next === "resolved" ? new Date().toISOString() : null }
          : r
      )
    );
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status: next }),
      });
      if (!res.ok) {
        setRows(prev);
      }
    } catch {
      setRows(prev);
    }
    setPendingIds((p) => {
      const n = new Set(p);
      n.delete(row.id);
      return n;
    });
  }

  function askResolve(row: FeedbackRow) {
    setConfirmState({
      message: `Mark this feedback as resolved?`,
      onConfirm: () => toggleStatus(row),
    });
  }

  return (
    <div>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
          confirmLabel="Resolve"
          tone="navy"
        />
      )}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Feedback</h1>
        <p className="text-sm text-navy-light mt-1">
          Student reports from the in-app feedback widget. Resolve items as you act on
          them; nothing is deleted on purpose so the record stays honest.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["open", "resolved", "all"] as Filter[]).map((f) => {
          const count = f === "all" ? rows.length : counts[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "text-sm font-medium px-3 py-1.5 rounded-full transition-colors " +
                (filter === f ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50")
              }
            >
              {f === "all" ? "All" : f === "open" ? "Open" : "Resolved"} ({count})
            </button>
          );
        })}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto text-xs font-medium text-navy-light hover:text-navy disabled:opacity-50"
        >
          {loading ? "Loading\u2026" : "Refresh"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        {loading && rows.length === 0 ? (
          <p className="text-sm text-navy-light p-5">Loading&hellip;</p>
        ) : loadError ? (
          <p className="text-sm text-rose p-5">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-navy-light p-5">
            {filter === "open"
              ? "No open feedback. Inbox zero."
              : filter === "resolved"
              ? "No resolved feedback yet."
              : "No feedback yet."}
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {filtered.map((r) => (
              <li key={r.id} className="p-5 flex gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${CATEGORY_TONE[r.category]}`}
                    >
                      {CATEGORY_LABELS[r.category]}
                    </span>
                    <span className="text-xs text-navy-light">{formatDate(r.created_at)}</span>
                    {r.status === "resolved" && r.resolved_at && (
                      <span className="text-xs text-emerald">
                        &middot; resolved {formatDate(r.resolved_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap mb-2">
                    {r.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-light">
                    {r.contact_email && (
                      <a
                        href={`mailto:${r.contact_email}`}
                        className="text-navy hover:underline"
                      >
                        Reply: {r.contact_email}
                      </a>
                    )}
                    {r.page_url && (
                      <span className="truncate max-w-xs" title={r.page_url}>
                        From: {new URL(r.page_url).pathname}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  {r.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => askResolve(r)}
                      disabled={pendingIds.has(r.id)}
                      className="text-xs font-medium text-white bg-emerald rounded-full px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleStatus(r)}
                      disabled={pendingIds.has(r.id)}
                      className="text-xs font-medium text-navy-light hover:text-navy disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
