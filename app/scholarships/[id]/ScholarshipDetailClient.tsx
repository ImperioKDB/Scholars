"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MatchSeal } from "@/components/MatchSeal";
import { BackLink } from "@/components/BackLink";
import { ShareButton } from "@/components/ShareButton";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { CompetitivenessBadge, type CompetitivenessTier } from "@/components/CompetitivenessBadge";
import { RequirementsList, type Requirement } from "@/components/RequirementsList";
import { fetchWithTimeout } from "@/lib/fetch";
import { useAde } from "@/components/ade/AdeProvider";

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
  eligibilityScore: number;
  competitivenessFactor: number;
  awards_available: number | null;
  estimated_applicant_pool: number | null;
  competitiveness_tier: CompetitivenessTier | null;
  historical_acceptance_rate: number | null;
  tier: "excellent" | "good" | "possible" | "unlikely";
  requirements: Requirement[];
};

export type SimilarScholarship = {
  id: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
};

type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected";

const TIER_LABELS: Record<ScholarshipDetail["tier"], string> = {
  excellent: "Excellent fit",
  good: "Worth a look",
  possible: "Possible",
  unlikely: "Long shot",
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function ScholarshipDetailClient({
  scholarship,
  initialSaved,
  initialApplication,
  sharerId,
  similar,
}: {
  scholarship: ScholarshipDetail;
  initialSaved: boolean;
  initialApplication: { id: string; status: ApplicationStatus } | null;
  sharerId: string;
  similar: SimilarScholarship[];
}) {
  const router = useRouter();
  const { interceptApply } = useAde();
  const [saved, setSaved] = useState(initialSaved);
  const [application, setApplication] = useState(initialApplication);
  const [savePending, setSavePending] = useState(false);
  const [trackPending, setTrackPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // APPLY CLICK TRACKING: the detail page apply link used to be a
  // plain anchor, so Ade never learned the student left for the
  // provider's portal unless they happened to use Open application
  // on the Applications page. Recording the click here (tracked
  // applications only) is what makes Ade's next-visit check-in fire.
  function recordApplyClick() {
    if (!application) return;
    fetchWithTimeout(`/api/applications/${application.id}/click`, {
      method: "POST",
    }).catch(() => {});
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  async function toggleSave() {
    setActionError(null);
    const wasSaved = saved;
    setSaved(!wasSaved);
    setSavePending(true);
    try {
      const res = wasSaved
        ? await fetchWithTimeout("/api/scholarships/save?scholarship_id=" + scholarship.id, { method: "DELETE" })
        : await fetchWithTimeout("/api/scholarships/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scholarship_id: scholarship.id }),
          });
      if (!res.ok) {
        setSaved(wasSaved);
        setActionError("Couldn't update saved status. Try again.");
      }
    } catch {
      setSaved(wasSaved);
      setActionError("Couldn't update saved status. Check your connection and try again.");
    }
    setSavePending(false);
  }

  async function startTracking() {
    setActionError(null);
    setTrackPending(true);
    try {
      const res = await fetchWithTimeout("/api/applications", {
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
    } catch {
      setActionError("Couldn't start tracking. Check your connection and try again.");
    }
    setTrackPending(false);
  }

  return (
    <div>
      <BackLink href="/dashboard" label="Back to matches" />
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
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <DeadlineBadge deadline={scholarship.deadline} />
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
        <CompetitivenessBadge
          awardsAvailable={scholarship.awards_available}
          estimatedApplicantPool={scholarship.estimated_applicant_pool}
          competitivenessTier={scholarship.competitiveness_tier}
          historicalAcceptanceRate={scholarship.historical_acceptance_rate}
        />
        {scholarship.competitivenessFactor < 1 && (
          <p className="text-xs text-navy-light mt-2">
            You meet <span className="font-mono text-ink">{scholarship.eligibilityScore}%</span> of this
            scholarship&apos;s requirements. The score above reflects that this award is more competitive
            than average.
          </p>
        )}
        {scholarship.description && (
          <p className="text-sm text-ink leading-relaxed mb-6 mt-4">{scholarship.description}</p>
        )}
        {actionError && <p className="text-sm text-rose mb-4" role="alert">{actionError}</p>}
        <div className="flex flex-wrap items-center gap-3 mb-8 pb-8 border-b border-hairline">
          {scholarship.application_url && (
            <button
              type="button"
              onClick={() =>
                interceptApply({
                  scholarshipId: scholarship.id,
                  scholarshipTitle: scholarship.title,
                  applicationUrl: scholarship.application_url as string,
                  applicationId: application ? application.id : null,
                })
              }
              className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors"
            >
              Apply on provider’s site →
            </button>
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
          <ShareButton variant="full" scholarshipId={scholarship.id} title={scholarship.title} sharerId={sharerId} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">Eligibility requirements</h2>
          <RequirementsList requirements={scholarship.requirements} />
        </div>
      </div>
      {similar.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy mb-4">Similar scholarships</h2>
          <div className="grid gap-3">
            {similar.map((s) => (
              <Link
                key={s.id}
                href={`/scholarships/${s.id}`}
                className="bg-white rounded-xl border border-hairline p-4 flex items-center gap-4 shadow-card hover:border-navy/30 transition-colors"
              >
                <ProviderMonogram name={s.provider_name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink text-sm leading-snug">{s.title}</p>
                  <p className="text-xs text-navy-light mt-0.5">{s.provider_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <DeadlineBadge deadline={s.deadline} />
                    {s.amount && <span className="text-xs font-mono text-emerald">{s.amount}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
