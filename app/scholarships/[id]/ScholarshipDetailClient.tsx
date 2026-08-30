"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";
import { MatchSeal } from "@/components/MatchSeal";
import { RequirementsList, type Requirement } from "@/components/RequirementsList";

type ScholarshipDetail = {
  id: string;
  title: string;
  provider_name: string;
  description: string | null;
  amount: string | null;
  deadline: string | null;
  application_url: string | null;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  score: number;
  tier: "excellent" | "good" | "possible" | "unlikely";
  requirements: Requirement[];
};

type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected";

const TIER_LABELS: Record<ScholarshipDetail["tier"], string> = {
  excellent: "Excellent fit",
  good: "Worth a look",
  possible: "Possible",
  unlikely: "Long shot",
};

const DEADLINE_TONE_CLASSES: Record<ReturnType<typeof deadlineTone>, string> = {
  closed: "bg-hairline text-navy-light",
  urgent: "bg-rose-light text-rose",
  soon: "bg-amber-light text-amber",
  later: "bg-navy-50 text-navy-light",
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
};

// Receives everything it needs from the server component
// (app/scholarships/[id]/page.tsx) -- no fetch-on-mount waterfall. Save
// and track-application actions hit the existing /api/scholarships/save
// and /api/applications routes, same ones the dashboard already uses.
//
// Eligibility requirements now render via RequirementsList
// (components/RequirementsList.tsx) instead of a flat <ul> -- that
// component groups by status (missing from profile / not met / met /
// verify with provider) so the actionable group surfaces first, and
// collapses long requirement strings (e.g. a 15-item discipline list)
// behind a "Show all" toggle instead of always rendering them in full.
export function ScholarshipDetailClient({
  scholarship,
  initialSaved,
  initialApplication,
}: {
  scholarship: ScholarshipDetail;
  initialSaved: boolean;
  initialApplication: { id: string; status: ApplicationStatus } | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [application, setApplication] = useState(initialApplication);
  const [savePending, setSavePending] = useState(false);
  const [trackPending, setTrackPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const days = daysUntil(scholarship.deadline);

  async function toggleSave() {
    setActionError(null);
    const wasSaved = saved;
    setSaved(!wasSaved);
    setSavePending(true);

    const res = wasSaved
      ? await fetch(`/api/scholarships/save?scholarship_id=${scholarship.id}`, { method: "DELETE" })
      : await fetch("/api/scholarships/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scholarship_id: scholarship.id }),
        });

    if (!res.ok) {
      setSaved(wasSaved);
      setActionError("Couldn't update saved status. Try again.");
    }
    setSavePending(false);
  }

  async function startTracking() {
    setActionError(null);
    setTrackPending(true);

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scholarship_id: scholarship.id }),
    });

    if (res.ok) {
      const data = await res.json();
      setApplication(data.application ?? { id: "", status: "in_progress" });
      router.refresh();
    } else {
      setActionError("Couldn't start tracking. Try again.");
    }
    setTrackPending(false);
  }

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-navy-light hover:text-navy mb-6 inline-block">
        &larr; Back to matches
      </Link>

      <div className="bg-white rounded-2xl border border-hairline shadow-card p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <MatchSeal score={scholarship.score} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-navy-light uppercase tracking-wide mb-1">
              {TIER_LABELS[scholarship.tier]}
            </p>
            <h1 className="font-display text-2xl font-semibold text-navy leading-snug">{scholarship.title}</h1>
            <p className="text-sm text-navy-light mt-1">{scholarship.provider_name}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {days !== null && (
            <span className={`text-xs font-mono font-medium px-2 py-1 rounded-full ${DEADLINE_TONE_CLASSES[deadlineTone(days)]}`}>
              {formatDeadlineLabel(days)}
            </span>
          )}
          {scholarship.amount && (
            <span className="text-xs font-mono font-medium text-emerald bg-emerald-light px-2 py-1 rounded-full">
              {scholarship.amount}
            </span>
          )}
          <span className="text-xs text-navy-light capitalize px-2 py-1">
            {scholarship.level === "both" ? "Undergrad & postgrad" : scholarship.level}
          </span>
          {scholarship.discipline && (
            <span className="text-xs text-navy-light px-2 py-1">&middot; {scholarship.discipline}</span>
          )}
        </div>

        {scholarship.description && (
          <p className="text-sm text-ink leading-relaxed mb-6">{scholarship.description}</p>
        )}

        {actionError && <p className="text-sm text-rose mb-4">{actionError}</p>}

        <div className="flex flex-wrap items-center gap-3 mb-8 pb-8 border-b border-hairline">
          {scholarship.application_url && (
            <a
              href={scholarship.application_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors"
            >
              Apply on provider&apos;s site &rarr;
            </a>
          )}

          <button
            type="button"
            onClick={toggleSave}
            disabled={savePending}
            className={[
              "rounded-seal text-sm font-medium px-5 py-2.5 border transition-colors disabled:opacity-60",
              saved ? "border-emerald text-emerald bg-emerald-light" : "border-hairline text-navy-light hover:border-navy/40",
            ].join(" ")}
          >
            {saved ? "Saved \u2713" : "Save"}
          </button>

          {application ? (
            <span className="text-sm font-medium text-navy-light px-2">
              Tracking &middot; {STATUS_LABELS[application.status]}
            </span>
          ) : (
            <button
              type="button"
              onClick={startTracking}
              disabled={trackPending}
              className="rounded-seal text-sm font-medium px-5 py-2.5 border border-hairline text-navy-light hover:border-navy/40 transition-colors disabled:opacity-60"
            >
              {trackPending ? "Adding\u2026" : "+ Track application"}
            </button>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">Eligibility requirements</h2>
          <RequirementsList requirements={scholarship.requirements} />
        </div>
      </div>
    </div>
  );
}
