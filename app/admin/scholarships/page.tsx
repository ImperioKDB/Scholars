"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  title: string;
  provider_name: string;
  deadline: string;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  verified: boolean;
  scholarship_rules: { id: string }[];
};

export default function AdminScholarshipsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "pending">("all");

  async function load() {
    setLoading(true);
    setLoadError(null);
    const res = await fetch("/api/admin/scholarships");
    if (res.status === 403) {
      setLoadError("Admin access required. Ask an existing admin to set is_admin on your profile.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setLoadError("Couldn't load scholarships.");
      setLoading(false);
      return;
    }
    const { scholarships } = await res.json();
    setRows(
      [...scholarships].sort((a: Row, b: Row) => (a.deadline < b.deadline ? -1 : 1))
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
    const res = await fetch(`/api/admin/scholarships/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !row.verified }),
    });
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, verified: row.verified } : r)));
    }
  }

  async function remove(row: Row) {
    if (!confirm(`Delete "${row.title}"? This also deletes its eligibility rules.`)) return;
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    const res = await fetch(`/api/admin/scholarships/${row.id}`, { method: "DELETE" });
    if (!res.ok) setRows(prev);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-navy">Scholarships</h1>
        <Link
          href="/admin/scholarships/new"
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
        >
          + Add scholarship
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
          <p className="text-sm text-navy-light p-5">No scholarships match this filter.</p>
        ) : (
          /* AUDIT FIX (batch 5): the table used to overflow the viewport
             on phones with no way to reach the last columns. It now
             scrolls horizontally inside its card; min-w keeps the
             columns readable instead of crushing them. */
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-navy-light">
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Level</th>
                  <th className="px-5 py-3 font-medium">Discipline</th>
                  <th className="px-5 py-3 font-medium">Rules</th>
                  <th className="px-5 py-3 font-medium">Deadline</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/scholarships/${s.id}/edit`} className="font-medium text-ink hover:text-navy">
                        {s.title}
                      </Link>
                      <p className="text-xs text-navy-light">{s.provider_name}</p>
                    </td>
                    <td className="px-5 py-3 text-navy-light capitalize">{s.level}</td>
                    <td className="px-5 py-3 text-navy-light">{s.discipline ?? "Any"}</td>
                    <td className="px-5 py-3 text-navy-light font-mono">{s.scholarship_rules?.length ?? 0}</td>
                    <td className="px-5 py-3 text-navy-light">{s.deadline}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleVerified(s)}
                        className={
                          "text-xs font-medium px-2 py-1 rounded-full transition-colors " +
                          (s.verified ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber")
                        }
                      >
                        {s.verified ? "Verified" : "Pending review"}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right space-x-3">
                      <Link href={`/admin/scholarships/${s.id}/edit`} className="text-navy hover:underline">
                        Edit
                      </Link>
                      <button onClick={() => remove(s)} className="text-rose hover:underline">
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
