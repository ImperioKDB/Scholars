"use client";
import { useCallback, useEffect, useState } from "react";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";
// app/admin/feedback/page.tsx
// In-app feedback inbox. Mirrors the support mailbox but lives where the
// rest of admin work happens, and lets feedback be resolved (not deleted)
// so response hygiene is visible. Category chips reuse the intake's four
// categories so the two surfaces never drift.
type FeedbackRow = {
  id: string;
  category: "bug" | "feature" | "scholarship" | "other";
  message: string;
  contact_email: string | null;
  page_url: string | null;
  created_at: string;
  status: "open" | "resolved";
  resolved_at: string | null;
  profiles: { full_name: string | null } | null;
};
const CATEGORY_TONE: Record<FeedbackRow["category"], string> = {
  bug: "bg-rose-light text-rose",
  feature: "bg-navy-50 text-navy",
  scholarship: "bg-amber-light text-amber",
  other: "bg-hairline text-navy-light",
};
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchWithTimeout("/api/admin/feedback");
      if (!res.ok) {
        setLoadError("Couldn't load feedback. Try again.");
        return;
      }
      const data = await res.json();
      setRows(data.feedback ?? []);
    } catch {
      setLoadError("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function setStatus(id: string, status: "open" | "resolved") {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetchWithTimeout("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        setError("Couldn't update that feedback. Try again.");
        return;
      }
      setNotice(status === "resolved" ? "Marked resolved." : "Reopened.");
      await load();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusyId(null);
    }
  }
  const visible = rows.filter((r) => (filter === "all" ? true : r.status === filter));
  const openCount = rows.filter((r) => r.status === "open").length;
  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Feedback</h1>
          <p className="text-sm text-navy-light mt-1">
            {openCount} open · {rows.length - openCount} resolved. Resolve, don&apos;t delete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                "text-sm font-medium px-3 py-1.5 rounded-full transition-colors " +
                (filter === f ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50")
              }
            >
              {f === "open" ? "Open" : f === "resolved" ? "Resolved" : "All"}
            </button>
          ))}
        </div>
      </div>
      <StatusMessage tone="success">{notice}</StatusMessage>
      <StatusMessage tone="error">{error}</StatusMessage>
      {loadError && (
        <p className="text-sm text-rose mb-6" role="alert">
          {loadError}{" "}
          <button type="button" onClick={load} className="font-medium underline">
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p className="text-sm text-navy-light">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">
            {filter === "open" ? "No open feedback. Nice." : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((r) => (
            <li key={r.id} className="bg-white rounded-xl border border-hairline p-5">
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${CATEGORY_TONE[r.category]}`}>
                    {r.category}
                  </span>
                  <span
                    className={
                      "text-xs font-medium px-2 py-1 rounded-full " +
                      (r.status === "open" ? "bg-amber-light text-amber" : "bg-emerald-light text-emerald")
                    }
                  >
                    {r.status}
                  </span>
                  <span className="text-xs text-navy-light">{formatWhen(r.created_at)}</span>
                </div>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => setStatus(r.id, r.status === "open" ? "resolved" : "open")}
                  className="text-xs font-medium text-navy hover:underline disabled:opacity-50"
                >
                  {r.status === "open" ? "Mark resolved" : "Reopen"}
                </button>
              </div>
              <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{r.message}</p>
              <div className="mt-3 text-xs text-navy-light space-y-0.5">
                <p>
                  From:{" "}
                  <span className="font-medium text-navy">
                    {r.profiles?.full_name || "Unknown student"}
                  </span>
                  {r.contact_email ? ` · ${r.contact_email}` : ""}
                </p>
                {r.page_url && <p>Page: {r.page_url}</p>}
                {r.resolved_at && <p>Resolved {formatWhen(r.resolved_at)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
