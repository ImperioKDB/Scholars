"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";
import type { CardScholarship } from "@/components/ScholarshipCard";
import { StatusDonut } from "@/components/StatusDonut";
import { DraftPanel, type Draft } from "@/components/DraftPanel";
import { useAde } from "@/components/ade/AdeProvider";

type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected";

type ApplicationApiItem = Draft & {
  id: string;
  status: ApplicationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  scholarship: CardScholarship;
};

type SavedApiItem = {
  id: string;
  saved_at: string;
  scholarship: CardScholarship;
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
};

const STATUS_TONE: Record<ApplicationStatus, string> = {
  in_progress: "bg-amber-light text-amber",
  submitted: "bg-navy-50 text-navy",
  accepted: "bg-emerald-light text-emerald",
  rejected: "bg-rose-light text-rose",
};

const DEADLINE_TONE_CLASSES: Record<ReturnType<typeof deadlineTone>, string> = {
  closed: "bg-hairline text-navy-light",
  urgent: "bg-rose-light text-rose",
  soon: "bg-amber-light text-amber",
  later: "bg-navy-50 text-navy-light",
};

// Receives initial data from the server component (app/applications/page.tsx)
// -- no fetch-on-mount waterfall. `load()` is kept as a refetch helper for
// after mutations (start/stop tracking, a failed status update), which is
// a normal user-triggered network call via the existing API routes, not
// part of first paint.
//
// "Open application" now routes through useAde().confirmApply() instead of
// a bare <a href>. Every row here already has a tracked application, so
// alreadyTracked is always true -- confirmApply's alreadyTracked branch
// just records the /click timestamp and opens the tab, which is what
// makes Ade's post-deadline "did you hear back?" check-in possible at all.
export function ApplicationsClient({
  initialApplications,
  initialSaved,
  initialError,
}: {
  initialApplications: ApplicationApiItem[];
  initialSaved: SavedApiItem[];
  initialError: string | null;
}) {
  const router = useRouter();
  const { confirmApply } = useAde();

  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [applications, setApplications] = useState<ApplicationApiItem[]>(initialApplications);
  const [saved, setSaved] = useState<SavedApiItem[]>(initialSaved);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoadError(null);

    const [appsRes, savedRes] = await Promise.all([
      fetch("/api/applications"),
      fetch("/api/scholarships/save"),
    ]);

    if (!appsRes.ok) {
      setLoadError("Couldn't load your applications. Try refreshing.");
      return;
    }

    const appsData = await appsRes.json();
    setApplications(appsData.applications ?? []);

    if (savedRes.ok) {
      const savedData = await savedRes.json();
      setSaved(savedData.saved ?? []);
    }
  }

  const trackedScholarshipIds = useMemo(
    () => new Set(applications.map((a) => a.scholarship.id)),
    [applications]
  );

  const untrackedSaved = useMemo(
    () => saved.filter((s) => !trackedScholarshipIds.has(s.scholarship.id)),
    [saved, trackedScholarshipIds]
  );

  const counts = useMemo(() => {
    const c: Record<ApplicationStatus, number> = { in_progress: 0, submitted: 0, accepted: 0, rejected: 0 };
    for (const a of applications) c[a.status] += 1;
    return c;
  }, [applications]);

  async function startTracking(scholarshipId: string) {
    setPendingIds((p) => new Set(p).add(scholarshipId));
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scholarship_id: scholarshipId }),
    });
    if (res.ok) await load();
    setPendingIds((p) => {
      const next = new Set(p);
      next.delete(scholarshipId);
      return next;
    });
  }

  async function updateStatus(applicationId: string, status: ApplicationStatus) {
    setPendingIds((p) => new Set(p).add(applicationId));
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)));

    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) await load(); // fall back to a full reload on failure

    setPendingIds((p) => {
      const next = new Set(p);
      next.delete(applicationId);
      return next;
    });
  }

  async function stopTracking(applicationId: string) {
    if (!confirm("Stop tracking this application?")) return;
    setPendingIds((p) => new Set(p).add(applicationId));
    const prev = applications;
    setApplications((cur) => cur.filter((a) => a.id !== applicationId));

    const res = await fetch(`/api/applications/${applicationId}`, { method: "DELETE" });
    if (!res.ok) setApplications(prev);

    setPendingIds((p) => {
      const next = new Set(p);
      next.delete(applicationId);
      return next;
    });
  }

  function handleDraftChange(applicationId: string, updated: Draft) {
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, ...updated } : a)));
  }

  // alreadyTracked is always true here -- every application in this list
  // is, by definition, already being tracked -- so onTrack is never
  // actually invoked by confirmApply. It's provided only to satisfy the
  // function's required shape.
  function openApplication(a: ApplicationApiItem) {
    if (!a.scholarship.application_url) return;
    confirmApply({
      scholarshipTitle: a.scholarship.title,
      applicationUrl: a.scholarship.application_url,
      alreadyTracked: true,
      applicationId: a.id,
      onTrack: async () => ({ id: a.id }),
    });
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Applications</h1>
        <p className="text-sm text-navy-light mt-1 mb-6">
          {applications.length} scholarship{applications.length === 1 ? "" : "s"} you&apos;re tracking.
        </p>

        <div className="bg-white rounded-xl border border-hairline p-5">
          <StatusDonut counts={counts} />
        </div>
      </div>

      {loadError && (
        <p className="text-sm text-rose mb-6">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              router.refresh();
            }}
            className="font-medium underline"
          >
            Try again
          </button>
        </p>
      )}

      {untrackedSaved.length > 0 && (
        <div className="mb-10">
          <h2 className="font-display text-lg font-semibold text-navy mb-3">Start tracking</h2>
          <p className="text-sm text-navy-light mb-4">Scholarships you&apos;ve saved but aren&apos;t tracking yet.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {untrackedSaved.map((s) => (
              <div key={s.scholarship.id} className="bg-white rounded-xl border border-hairline p-4 flex items-center gap-3">
                <ProviderMonogram name={s.scholarship.provider_name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{s.scholarship.title}</p>
                  <p className="text-xs text-navy-light">{s.scholarship.provider_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startTracking(s.scholarship.id)}
                  disabled={pendingIds.has(s.scholarship.id)}
                  className="shrink-0 text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors disabled:opacity-50"
                >
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
          <p className="text-sm text-navy-light">
            Nothing tracked yet. Save a scholarship from your matches, then start tracking it here.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {applications.map((a) => {
            const days = daysUntil(a.scholarship.deadline);
            return (
              <div key={a.id} className="bg-white rounded-xl border border-hairline p-5 flex gap-4 shadow-card">
                <ProviderMonogram name={a.scholarship.provider_name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink leading-snug">{a.scholarship.title}</p>
                      <p className="text-xs text-navy-light mt-0.5">{a.scholarship.provider_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => stopTracking(a.id)}
                      disabled={pendingIds.has(a.id)}
                      className="shrink-0 text-xs text-navy-light hover:text-rose disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {days !== null && (
                      <span className={`text-xs font-mono font-medium px-2 py-1 rounded-full ${DEADLINE_TONE_CLASSES[deadlineTone(days)]}`}>
                        {formatDeadlineLabel(days)}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_TONE[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </div>

                  <label className="block mt-3">
                    <span className="sr-only">Status</span>
                    <select
                      value={a.status}
                      onChange={(e) => updateStatus(a.id, e.target.value as ApplicationStatus)}
                      disabled={pendingIds.has(a.id)}
                      className="text-sm rounded-lg border border-hairline bg-white px-3 py-2 disabled:opacity-50"
                    >
                      {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>

                  {a.scholarship.application_url ? (
                    <button
                      type="button"
                      onClick={() => openApplication(a)}
                      className="inline-block text-xs font-medium text-navy hover:underline mt-3"
                    >
                      Open application &rarr;
                    </button>
                  ) : a.scholarship.how_to_apply ? (
                    // No direct link on file for this one (see
                    // migration: add_how_to_apply_fallback) -- show the
                    // guidance inline instead of just omitting the link.
                    <p className="text-xs text-navy-light mt-3 leading-relaxed">
                      <span className="font-medium text-ink">How to apply: </span>
                      {a.scholarship.how_to_apply}
                    </p>
                  ) : null}

                  <DraftPanel
                    applicationId={a.id}
                    scholarshipTitle={a.scholarship.title}
                    draft={{
                      draft_statement: a.draft_statement,
                      draft_summary: a.draft_summary,
                      draft_generated_at: a.draft_generated_at,
                      draft_confirmed_at: a.draft_confirmed_at,
                    }}
                    applicationUrl={a.scholarship.application_url}
                    onDraftChange={(updated) => handleDraftChange(a.id, updated)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 id="saved" className="font-display text-lg font-semibold text-navy mb-5 scroll-mt-20">
        Saved ({saved.length})
      </h2>

      {saved.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">
            Save scholarships from your matches above to track their deadlines here.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {saved.map((s) => (
            <div key={s.scholarship.id} className="bg-white rounded-xl border border-hairline p-5 flex gap-4 shadow-card">
              <ProviderMonogram name={s.scholarship.provider_name} size={52} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink leading-snug">{s.scholarship.title}</p>
                <p className="text-xs text-navy-light mt-0.5">{s.scholarship.provider_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
