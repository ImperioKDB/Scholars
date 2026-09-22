"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusMessage } from "@/components/StatusMessage";

type DiscussionRow = {
  id: string;
  scholarship_id: string;
  title: string | null;
  body: string;
  category: string;
  status: "published" | "hidden";
  is_pinned: boolean;
  is_verified_contributor: boolean;
  helpful_count: number;
  created_at: string;
  scholarship: { title: string; slug: string } | null;
};

type ReportRow = {
  id: string;
  discussion_id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "dismissed" | "removed";
  created_at: string;
  discussion: { title: string | null; body: string; scholarship_id: string } | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminDiscussionsPage() {
  const [discussions, setDiscussions] = useState<DiscussionRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "reports">("queue");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [discussionResponse, reportResponse] = await Promise.all([
        fetch("/api/admin/discussions?status=published"),
        fetch("/api/admin/discussion-reports?status=open"),
      ]);
      if (!discussionResponse.ok || !reportResponse.ok) throw new Error("load_failed");
      const discussionPayload = await discussionResponse.json();
      const reportPayload = await reportResponse.json();
      setDiscussions(discussionPayload.discussions ?? []);
      setReports(reportPayload.reports ?? []);
    } catch {
      setError("Couldn't load the moderation queue. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateDiscussion(id: string, patch: Partial<Pick<DiscussionRow, "status" | "is_pinned" | "is_verified_contributor">>) {
    const previous = discussions;
    setDiscussions((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row).filter((row) => row.status === "published"));
    const response = await fetch(`/api/admin/discussions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    if (!response?.ok) setDiscussions(previous);
  }

  async function updateReport(report: ReportRow, status: "reviewed" | "dismissed" | "removed") {
    const previous = reports;
    setReports((rows) => rows.filter((row) => row.id !== report.id));
    const response = await fetch(`/api/admin/discussion-reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    if (!response?.ok) setReports(previous);
    else if (status === "removed") setDiscussions((rows) => rows.filter((row) => row.id !== report.discussion_id));
  }

  const openReports = useMemo(() => reports.length, [reports]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Scholarship discussions</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-light">Keep community context useful and safe. Hide posts that need review, pin accurate updates, and verify trusted contributors.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="self-start text-xs font-medium text-navy-light hover:text-navy disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button>
      </div>
      {error && <StatusMessage tone="error" className="mb-4">{error}</StatusMessage>}
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("queue")} className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === "queue" ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50"}`}>Published posts ({discussions.length})</button>
        <button type="button" onClick={() => setTab("reports")} className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === "reports" ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50"}`}>Open reports ({openReports})</button>
      </div>
      {tab === "queue" ? (
        <div className="grid gap-3">
          {discussions.length === 0 ? <div className="rounded-xl border border-dashed border-hairline bg-white p-5 text-sm text-navy-light">No published community posts yet.</div> : discussions.map((row) => (
            <article key={row.id} className="rounded-xl border border-hairline bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-xs text-navy-light"><span className="rounded-full bg-navy-50 px-2 py-1 font-medium text-navy">{row.category}</span><span>{formatDate(row.created_at)}</span><span>Helpful: {row.helpful_count}</span>{row.scholarship && <Link href={`/scholarship/${row.scholarship.slug}`} className="text-navy hover:underline">{row.scholarship.title}</Link>}</div>
              {row.title && <h2 className="mt-2 font-display text-lg font-semibold text-navy">{row.title}</h2>}
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{row.body}</p>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
                <button type="button" onClick={() => updateDiscussion(row.id, { is_pinned: !row.is_pinned })} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${row.is_pinned ? "border-amber bg-amber-light text-amber" : "border-hairline text-navy-light"}`}>{row.is_pinned ? "Unpin" : "Pin update"}</button>
                <button type="button" onClick={() => updateDiscussion(row.id, { is_verified_contributor: !row.is_verified_contributor })} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${row.is_verified_contributor ? "border-emerald bg-emerald-light text-emerald" : "border-hairline text-navy-light"}`}>{row.is_verified_contributor ? "Remove verified label" : "Verify contributor"}</button>
                <button type="button" onClick={() => updateDiscussion(row.id, { status: "hidden" })} className="rounded-full border border-rose/30 px-3 py-1.5 text-xs font-medium text-rose">Hide post</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {reports.length === 0 ? <div className="rounded-xl border border-dashed border-hairline bg-white p-5 text-sm text-navy-light">No open reports.</div> : reports.map((report) => (
            <article key={report.id} className="rounded-xl border border-amber/30 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-xs text-navy-light"><span className="rounded-full bg-amber-light px-2 py-1 font-medium text-amber">{report.reason.replaceAll("_", " ")}</span><span>{formatDate(report.created_at)}</span></div>
              {report.discussion?.title && <h2 className="mt-2 font-display text-lg font-semibold text-navy">{report.discussion.title}</h2>}
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{report.discussion?.body ?? "Post unavailable"}</p>
              {report.details && <p className="mt-2 rounded-lg bg-parchment p-3 text-xs leading-relaxed text-navy-light">Reporter note: {report.details}</p>}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3"><button type="button" onClick={() => updateReport(report, "dismissed")} className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-navy-light">Dismiss</button><button type="button" onClick={() => updateReport(report, "reviewed")} className="rounded-full border border-emerald/30 px-3 py-1.5 text-xs font-medium text-emerald">Mark reviewed</button><button type="button" onClick={() => updateReport(report, "removed")} className="rounded-full bg-rose px-3 py-1.5 text-xs font-medium text-white">Remove post</button></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
