"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Row = {
  id: string;
  type: "fellowship" | "internship" | "competition" | "mentorship";
  title: string;
  provider_name: string;
  deadline: string | null;
  discipline: string | null;
  verified: boolean;
};

const TYPE_LABELS: Record<Row["type"], string> = {
  fellowship: "Fellowship",
  internship: "Internship",
  competition: "Competition",
  mentorship: "Mentorship",
};

export default function AdminOpportunitiesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "pending">("all");
  // FINAL CLEANUP: native confirm() replaced with the shared focus-trapped
  // ConfirmDialog, same as the scholarships admin list.
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const res = await fetch("/api/admin/opportunities");
    if (res.status === 403) {
      setLoadError("Admin access required. Ask an existing admin to set is_admin on your profile.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setLoadError("Couldn't load opportunities.");
      setLoading(false);
      return;
    }
    const { opportunities } = await res.json();
    setRows(
      [...opportunities].sort((a: Row, b: Row) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline < b.deadline ? -1 : 1;
      })
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "verified") return rows.filter((r) => r.verified);
    if (filter === "pending") return rows.filter((r) => !r.verified);
    return rows;
  }, [rows, filter]);

  async function toggleVerified(row: Row) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, verified: !r.verified } : r)));
    const res = await fetch(`/api/admin/opportunities/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !row.verified }),
    });
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, verified: row.verified } : r)));
    }
  }

  async function doRemove(row: Row) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    const res = await fetch(`/api/admin/opportunities/${row.id}`, { method: "DELETE" });
    if (!res.ok) setRows(prev);
  }

  function remove(row: Row) {
    setConfirmState({
      message: `Delete "${row.title}"? This can't be undone.`,
      onConfirm: () => doRemove(row),
    });
  }

  return (
    <div>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
          confirmLabel="Delete"
          tone="rose"
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-navy">Opportunities</h1>
        <Link
          href="/admin/opportunities/new"
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
        >
          + Add opportunity
        </Link>
      </div>
      <div className="flex items-center gap-2 mb-4">
        {(["all", "verified", "pending"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "text-sm font-medium px-3 py-1.5 rounded-full transition-colors " +
              (filter === f ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50")
            }
          >
            {f === "all" ? "All" : f === "verified" ? "Verified" : "Pending review"}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        {loading ? (
          <p className="text-sm text-navy-light p-5">Loading&hellip;</p>
        ) : loadError ? (
          <p className="text-sm text-rose p-5">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-navy-light p-5">No opportunities match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-navy-light">
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Discipline</th>
                  <th className="px-5 py-3 font-medium">Deadline</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-hairline last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/opportunities/${o.id}/edit`} className="font-medium text-ink hover:text-navy">
                        {o.title}
                      </Link>
                      <p className="text-xs text-navy-light">{o.provider_name}</p>
                    </td>
                    <td className="px-5 py-3 text-navy-light">{TYPE_LABELS[o.type]}</td>
                    <td className="px-5 py-3 text-navy-light">{o.discipline ?? "Any"}</td>
                    <td className="px-5 py-3 text-navy-light">{o.deadline ?? "Rolling"}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleVerified(o)}
                        className={
                          "text-xs font-medium px-2 py-1 rounded-full transition-colors " +
                          (o.verified ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber")
                        }
                      >
                        {o.verified ? "Verified" : "Pending review"}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right space-x-3">
                      <Link href={`/admin/opportunities/${o.id}/edit`} className="text-navy hover:underline">
                        Edit
                      </Link>
                      <button onClick={() => remove(o)} className="text-rose hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
