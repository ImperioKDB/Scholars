"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import type { CardScholarship } from "@/components/ScholarshipCard";
import { StatusDonut } from "@/components/StatusDonut";
import { DraftPanel, type Draft } from "@/components/DraftPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAde } from "@/components/ade/AdeProvider";
import { fetchWithTimeout } from "@/lib/fetch";
type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected";
type ApplicationApiItem = Draft & {
  id: string; status: ApplicationStatus; notes: string | null; created_at: string; updated_at: string;
  scholarship: CardScholarship;
};
type SavedApiItem = { id: string; saved_at: string; scholarship: CardScholarship };
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  in_progress: "In progress", submitted: "Submitted", accepted: "Accepted", rejected: "Rejected",
};
const STATUS_TONE: Record<ApplicationStatus, string> = {
  in_progress: "bg-amber-light text-amber", submitted: "bg-navy-50 text-navy",
  accepted: "bg-emerald-light text-emerald", rejected: "bg-rose-light text-rose",
};
export function ApplicationsClient({ initialApplications, initialSaved, initialError }: {
  initialApplications: ApplicationApiItem[]; initialSaved: SavedApiItem[]; initialError: string | null;
}) {
  const router = useRouter();
  const { confirmApply } = useAde();
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationApiItem[]>(initialApplications);
  const [saved, setSaved] = useState<SavedApiItem[]>(initialSaved);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  async function load() {
    setLoadError(null);
    try {
      const [appsRes, savedRes] = await Promise.all([
        fetchWithTimeout("/api/applications"),
        fetchWithTimeout("/api/scholarships/save"),
      ]);
      if (!appsRes.ok) { setLoadError("Couldn't load your applications. Try refreshing."); return; }
      const appsData = await appsRes.json();
      setApplications(appsData.applications ?? []);
      if (savedRes.ok) { const savedData = await savedRes.json(); setSaved(savedData.saved ?? []); }
    } catch {
      setLoadError("Couldn't load your applications. Check your connection and try again.");
    }
  }
  const trackedScholarshipIds = useMemo(() => new Set(applications.map((a) => a.scholarship.id)), [applications]);
  const untrackedSaved = useMemo(() => saved.filter((s) => !trackedScholarshipIds.has(s.scholarship.id)), [saved, trackedScholarshipIds]);
  const counts = useMemo(() => {
    const c: Record<ApplicationStatus, number> = { in_progress: 0, submitted: 0, accepted: 0, rejected: 0 };
    for (const a of applications) c[a.status] += 1;
    return c;
  }, [applications]);
  async function startTracking(scholarshipId: string) {
    setPendingIds((p) => new Set(p).add(scholarshipId));
    setActionError(null);
    try {
      const res = await fetchWithTimeout("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scholarship_id: scholarshipId }),
      });
      if (res.ok) await load();
      else setActionError("Couldn't start tracking. Try again.");
    } catch {
      setActionError("Couldn't start tracking. Check your connection and try again.");
    }
    setPendingIds((p) => { const n = new Set(p); n.delete(scholarshipId); return n; });
  }
  async function updateStatus(applicationId: string, status: ApplicationStatus) {
    setPendingIds((p) => new Set(p).add(applicationId));
    setActionError(null);
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)));
    setFlashIds((prev) => new Set(prev).add(applicationId));
    setTimeout(() => setFlashIds((prev) => { const n = new Set(prev); n.delete(applicationId); return n; }), 750);
    try {
      const res = await fetchWithTimeout(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) await load();
    } catch {
      setActionError("Couldn't update status. Check your connection and try again.");
      await load();
    }
    setPendingIds((p) => { const n = new Set(p); n.delete(applicationId); return n; });
  }
  async function doStopTracking(applicationId: string) {
    setPendingIds((p) => new Set(p).add(applicationId));
    setActionError(null);
    const prev = applications;
    setApplications((cur) => cur.filter((a) => a.id !== applicationId));
    try {
      const res = await fetchWithTimeout(`/api/applications/${applicationId}`, { method: "DELETE" });
      if (!res.ok) setApplications(prev);
    } catch {
      setApplications(prev);
      setActionError("Couldn't stop tracking. Check your connection and try again.");
    }
    setPendingIds((p) => { const n = new Set(p); n.delete(applicationId); return n; });
  }
  function stopTracking(applicationId: string) {
    setConfirmState({
      message: "Stop tracking this application? It leaves your Applications list; any saved scholarship stays saved.",
      onConfirm: () => doStopTracking(applicationId),
    });
  }
  function handleDraftChange(applicationId: string, updated: Draft) {
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, ...updated } : a)));
  }
  function openApplication(a: ApplicationApiItem) {
    if (!a.scholarship.application_url) return;
    confirmApply({ scholarshipTitle: a.scholarship.title, applicationUrl: a.scholarship.application_url, alreadyTracked: true, applicationId: a.id, onTrack: async () => ({ id: a.id }) });
  }
  return (
    <div>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
          confirmLabel="Stop tracking"
          tone="rose"
        />
      )}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Applications</h1>
        <p className="text-sm text-navy-light mt-1 mb-6">{applications.length} scholarship{applications.length === 1 ? "" : "s"} you&apos;re tracking.</p>
        <div className="bg-white rounded-xl border border-hairline p-5"><StatusDonut counts={counts} /></div>
      </div>
      {loadError && (
        <p className="text-sm text-rose mb-6" role="alert">
          {loadError}{" "}
          <button type="button" onClick={() => { setLoadError(null); router.refresh(); }} className="font-medium underline">Try again</button>
        </p>
      )}
      {actionError && (
        <p className="text-sm text-rose mb-6" role="alert">{actionError}</p>
      )}
      {untrackedSaved.length > 0 && (
        <div className="mb-10">
          <h2 className="font-display text-lg font-semibold text-navy mb-3">Start tracking</h2>
          <p className="text-sm text-navy-light mb-4">Scholarships you&apos;ve saved but aren&apos;t tracking yet.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {untrackedSaved.map((s) => (
              <div key={s.scholarship.id} className="bg-white rounded-xl border border-hairline p-4 flex items-center gap-3">
                <ProviderMonogram name={s.scholarship.provider_name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{s.scholarship.title}</p>
                  <p className="text-xs text-navy-light">{s.scholarship.provider_name}</p>
                </div>
                <button type="button" onClick={() => startTracking(s.scholarship.id)} disabled={pendingIds.has(s.scholarship.id)}
                  className="shrink-0 text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors disabled:opacity-50">
                  + Track
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <h2 className="font-display text-lg font-semibold text-navy mb-5">Tracked applications</h2>
      {applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">Nothing tracked yet. Save a scholarship from your matches, then start tracking it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {applications.map((a) => {
            return (
              <div key={a.id} className="relative bg-white rounded-xl border border-hairline p-5 flex gap-4 shadow-card">
                {flashIds.has(a.id) && <span className="status-flash" aria-hidden="true" />}
                <ProviderMonogram name={a.scholarship.provider_name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink leading-snug">{a.scholarship.title}</p>
                      <p className="text-xs text-navy-light mt-0.5">{a.scholarship.provider_name}</p>
                    </div>
                    <button type="button" onClick={() => stopTracking(a.id)} disabled={pendingIds.has(a.id)} className="shrink-0 text-xs text-navy-light hover:text-rose disabled:opacity-50">Remove</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <DeadlineBadge deadline={a.scholarship.deadline} />
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_TONE[a.status]}`}>{STATUS_LABELS[a.status]}</span>
                  </div>
                  <label className="block mt-3">
                    <span className="sr-only">Status</span>
                    <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value as ApplicationStatus)} disabled={pendingIds.has(a.id)}
                      className="text-sm rounded-lg border border-hairline bg-white px-3 py-2 disabled:opacity-50">
                      {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((s) => (<option key={s} value={s}>{STATUS_LABELS[s]}</option>))}
                    </select>
                  </label>
                  {/* OUTCOME LOOP (Push C): a rejection is a dead end today.
                      Point the student at open awards in their discipline so
                      a "no" becomes a next step instead of a stop. */}
                  {a.status === "rejected" && (
                    <Link
                      href={`/discover?discipline=${encodeURIComponent(a.scholarship.discipline ?? "")}`}
                      className="inline-block text-xs font-medium text-navy hover:underline mt-3"
                    >
                      Didn&apos;t work out? Browse similar open awards →
                    </Link>
                  )}
                  {a.scholarship.application_url ? (
                    <button type="button" onClick={() => openApplication(a)} className="inline-block text-xs font-medium text-navy hover:underline mt-3">Open application →</button>
                  ) : a.scholarship.how_to_apply ? (
                    <p className="text-xs text-navy-light mt-3 leading-relaxed"><span className="font-medium text-ink">How to apply: </span>{a.scholarship.how_to_apply}</p>
                  ) : null}
                  <DraftPanel applicationId={a.id} scholarshipTitle={a.scholarship.title}
                    draft={{ draft_statement: a.draft_statement, draft_summary: a.draft_summary, draft_generated_at: a.draft_generated_at, draft_confirmed_at: a.draft_confirmed_at }}
                    applicationUrl={a.scholarship.application_url} onDraftChange={(u) => handleDraftChange(a.id, u)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <h2 id="saved" className="font-display text-lg font-semibold text-navy mb-5 scroll-mt-20">Saved ({saved.length})</h2>
      {saved.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">Save scholarships from your matches above to track their deadlines here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {saved.map((s) => (
            <div key={s.scholarship.id} className="bg-white rounded-xl border border-hairline p-5 flex gap-4 shadow-card">
              <ProviderMonogram name={s.scholarship.provider_name} size={52} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink leading-snug">{s.scholarship.title}</p>
                <p className="text-xs text-navy-light">{s.scholarship.provider_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
