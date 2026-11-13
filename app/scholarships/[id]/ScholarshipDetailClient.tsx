"use client";
import { StatusMessage } from "@/components/StatusMessage";
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
import type { CyclePrediction } from "@/lib/cycles";
import { track } from "@/lib/analytics";
import { ReportScholarshipButton } from "@/components/ReportScholarshipButton";
import { ScholarshipCommunity } from "@/components/ScholarshipCommunity";
import type { ScholarshipCommunity as ScholarshipCommunityData } from "@/lib/scholarship-community";
import { getSavedReturnPath } from "@/lib/scrollRestore";
import { queueScholarshipSavedState } from "@/lib/offline/outbox";

type ScholarshipDetail = {
  id: string;
  slug?: string;
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
  cycle?: CyclePrediction | null;
  last_verified_at?: string | null;
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

type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected" | "not_applied";

const TIER_LABELS: Record<ScholarshipDetail["tier"], string> = {
  excellent: "Excellent fit",
  good: "Worth a look",
  possible: "Possible",
  unlikely: "Long shot",
};

function matchLabel(scholarship: ScholarshipDetail): string {
  const hasFailedGate = scholarship.requirements.some((requirement) => requirement.gating && requirement.status === "not_met");
  return hasFailedGate ? "Not eligible" : TIER_LABELS[scholarship.tier];
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  not_applied: "Didn't apply",
};

const NMSS_APPLICATION_URL = "https://csr-ngscholarship.totalenergies.com/scholarships/nmss";
const NMSS_GOVERNMENT_FORM_URL =
  "https://dragnet-solutions.com/wp-content/uploads/2025/06/NNPC-SNEPCo-NATIONAL-UNIVERSITY-SCHOLARSHIP-GOVERNMENT-OFFICIAL-INFORMATION-FORM-1.pdf";

function hasNmssGovernmentForm(scholarship: ScholarshipDetail): boolean {
  return (
    scholarship.application_url === NMSS_APPLICATION_URL &&
    scholarship.title.toLowerCase().includes("national merit scholarship")
  );
}

export function ScholarshipDetailClient({
  scholarship,
  initialSaved,
  initialApplication,
  sharerId,
  similar,
  initialCommunity,
}: {
  scholarship: ScholarshipDetail;
  initialSaved: boolean;
  initialApplication: { id: string; status: ApplicationStatus } | null;
  sharerId: string;
  similar: SimilarScholarship[];
  initialCommunity: ScholarshipCommunityData;
}) {
  const router = useRouter();
  const { interceptApply } = useAde();
  const [saved, setSaved] = useState(initialSaved);
  const [application, setApplication] = useState(initialApplication);
  const [backHref, setBackHref] = useState("/dashboard");
  useEffect(() => {
    try {
      const savedReturnPath = getSavedReturnPath();
      if (savedReturnPath) {
        setBackHref(savedReturnPath);
        return;
      }
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer && referrer.origin === window.location.origin && ["/dashboard", "/discover", "/scholarships"].some((prefix) => referrer.pathname === prefix || referrer.pathname.startsWith(`${prefix}/`))) {
        setBackHref(referrer.pathname + referrer.search);
      }
    } catch { /* keep the safe dashboard fallback */ }
  }, []);
  const [savePending, setSavePending] = useState(false);
  const [trackPending, setTrackPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  function recordApplyClick() {
    if (!application) return;
    fetchWithTimeout(`/api/applications/${application.id}/click`, {
      method: "POST",
    }).catch(() => {});
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    track("match_viewed", {
      scholarship_id: scholarship.id,
      score: scholarship.score,
      tier: scholarship.tier,
      eligible: scholarship.tier !== "unlikely",
    });
  }, []);

  async function toggleSave() {
    setActionError(null);
    setActionNotice(null);
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
      if (!res.ok && (res.status === 408 || res.status >= 500) && await queueScholarshipSavedState(sharerId, scholarship.id, !wasSaved)) {
        setActionNotice("Your change is saved on this device and will sync when connected.");
      } else if (!res.ok) {
        setSaved(wasSaved);
        setActionError(res.status === 401 ? "Your session needs to be refreshed before saving." : "Couldn't update saved status. Try again.");
      }
    } catch {
      if (await queueScholarshipSavedState(sharerId, scholarship.id, !wasSaved)) {
        setActionNotice("Your change is saved on this device and will sync when connected.");
      } else {
        setSaved(wasSaved);
        setActionError("Couldn't save this change offline. Check your connection and try again.");
      }
    } finally {
      setSavePending(false);
    }
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

  // Phase 4 outcome: when the tracked application is rejected, point the
  // student at open awards in the same discipline. Dead end becomes a
  // next step.
  const showRejectionRedirect = application?.status === "rejected";
  const failedGates = scholarship.requirements.filter((requirement) => requirement.gating && requirement.status === "not_met");

  return (
    <div>
      <BackLink href={backHref} label="Back to matches" />
      <div className="bg-white rounded-2xl border border-hairline shadow-card p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <MatchSeal score={scholarship.score} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-navy-light uppercase tracking-wide mb-1">
              {matchLabel(scholarship)}
            </p>
            <h1 className="font-display text-2xl font-semibold text-navy leading-snug">{scholarship.title}</h1>
            <p className="text-sm text-navy-light mt-1">{scholarship.provider_name}</p>
            {scholarship.last_verified_at && (
              <p className="text-xs text-navy-light mt-0.5">
                Verified by our team on {new Date(scholarship.last_verified_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <DeadlineBadge deadline={scholarship.deadline} />
          {scholarship.amount && (
            scholarship.amount.length > 80 ? (
              <div className="basis-full min-w-0 rounded-xl border border-emerald/20 bg-emerald-light/40 px-4 py-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald">Award support</p>
                <p className="break-words text-sm font-medium leading-relaxed text-emerald">{scholarship.amount}</p>
              </div>
            ) : (
              <span className="text-xs font-mono font-medium text-emerald bg-emerald-light px-2 py-1 rounded-full">
                {scholarship.amount}
              </span>
            )
          )}
          <span className="text-xs text-navy-light capitalize px-2 py-1">
            {scholarship.level === "both" ? "Undergrad & postgrad" : scholarship.level}
          </span>
          {scholarship.discipline && (
            <span className="text-xs text-navy-light px-2 py-1">&middot; {scholarship.discipline}</span>
          )}
        </div>

        {scholarship.cycle && (
          <p className="text-xs text-navy-light mb-4">
            This award runs in cycles. {scholarship.cycle.label}
            {scholarship.cycle.confidence === "observed"
              ? ", based on its past open windows"
              : ", estimated from its last close date"}
            . Save it and we will tell you when applications open.
          </p>
        )}

        <CompetitivenessBadge
          awardsAvailable={scholarship.awards_available}
          estimatedApplicantPool={scholarship.estimated_applicant_pool}
          competitivenessTier={scholarship.competitiveness_tier}
          historicalAcceptanceRate={scholarship.historical_acceptance_rate}
        />

        {failedGates.length > 0 && (
          <div className="mb-4 rounded-xl border border-rose/25 bg-rose-light px-4 py-3" role="status">
            <p className="text-sm font-semibold text-rose">Not eligible for this scholarship</p>
            <p className="mt-1 text-xs leading-relaxed text-ink">
              {failedGates.map((requirement) => requirement.requirement).join(". ")}.
            </p>
          </div>
        )}

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

      {actionError && <StatusMessage tone="error" className="mb-4">{actionError}</StatusMessage>}
      {actionNotice && <div role="status" className="mb-4 rounded-xl border border-navy/10 bg-navy-50 px-4 py-3 text-sm text-navy">{actionNotice}</div>}

        <div className="flex flex-wrap items-center gap-3 mb-8 pb-8 border-b border-hairline">
          {scholarship.application_url && (
            <button
              type="button"
              onClick={() =>
                interceptApply({
                  listingKind: "scholarship",
                  listingId: scholarship.id,
                  listingTitle: scholarship.title,
                  applicationUrl: scholarship.application_url as string,
                  applicationId: application ? application.id : null,
                })
              }
              className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors"
            >
              Apply on provider's site &rarr;
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
          <ShareButton variant="full" scholarshipId={scholarship.id} scholarshipSlug={scholarship.slug} title={scholarship.title} sharerId={sharerId} />
        </div>

        {/* PHASE 4 OUTCOME: rejection redirect on the detail page too.
            Same link as ApplicationsClient -- a "no" becomes a browse
            instead of a dead end, whichever surface the student is on. */}
        {showRejectionRedirect && (
          <div className="bg-rose-light border border-rose/20 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-rose mb-1">This one didn&apos;t work out</p>
            <p className="text-xs text-ink leading-relaxed mb-2">
              There are other open awards in {scholarship.discipline || "your field"} you may still be eligible for.
            </p>
            <Link
              href={`/discover?discipline=${encodeURIComponent(scholarship.discipline ?? "")}`}
              className="text-xs font-medium text-navy hover:underline"
            >
              Browse similar open awards &rarr;
            </Link>
          </div>
        )}

        <div>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">Eligibility requirements</h2>
          <RequirementsList requirements={scholarship.requirements} />
          {hasNmssGovernmentForm(scholarship) && (
            <div className="mt-6 rounded-xl border border-navy/15 bg-navy-50 p-4" aria-labelledby="nmss-government-form-title">
              <h3 id="nmss-government-form-title" className="text-sm font-semibold text-navy">
                Government official declaration form
              </h3>
              <a
                href={NMSS_GOVERNMENT_FORM_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-seal bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light"
              >
                Open the official form <span aria-hidden="true">&rarr;</span>
              </a>
              <p className="mt-3 text-xs leading-relaxed text-navy-light">
                This PDF is a government-official declaration and compliance form, not the online scholarship application. The supplied copy shows award year 2025, so confirm in the live 2026/2027 TotalEnergies application flow whether it is requested before completing or submitting it. Never pay anyone to access the form or apply.
              </p>
            </div>
          )}
          <ReportScholarshipButton scholarshipId={scholarship.id} />
        </div>
      </div>

      <ScholarshipCommunity
        scholarshipId={scholarship.id}
        initialDiscussions={initialCommunity.discussions}
        prompts={initialCommunity.prompts}
        socialProof={initialCommunity.socialProof}
        canInteract
      />

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
