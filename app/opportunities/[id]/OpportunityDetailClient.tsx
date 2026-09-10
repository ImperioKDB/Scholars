"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { ShareButton } from "@/components/ShareButton";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { fetchWithTimeout } from "@/lib/fetch";

export type OpportunityDetail = {
  id: string;
  type: "fellowship" | "internship" | "competition" | "mentorship";
  title: string;
  provider_name: string;
  description: string | null;
  eligibility_notes: string | null;
  duration: string | null;
  location: string | null;
  compensation: string | null;
  discipline: string | null;
  deadline: string | null;
  application_url: string | null;
  how_to_apply: string | null;
};

export type SimilarOpportunity = {
  id: string;
  type: "fellowship" | "internship" | "competition" | "mentorship";
  title: string;
  provider_name: string;
  compensation: string | null;
  deadline: string | null;
  discipline: string | null;
};

const TYPE_LABELS: Record<OpportunityDetail["type"], string> = {
  fellowship: "Fellowship",
  internship: "Internship",
  competition: "Competition",
  mentorship: "Mentorship",
};

const TYPE_TONE: Record<OpportunityDetail["type"], string> = {
  fellowship: "bg-navy-50 text-navy",
  internship: "bg-emerald-light text-emerald",
  competition: "bg-amber-light text-amber",
  mentorship: "bg-rose-light text-rose",
};

export function OpportunityDetailClient({
  opportunity,
  initialSaved,
  sharerId,
  similar,
}: {
  opportunity: OpportunityDetail;
  initialSaved: boolean;
  sharerId: string;
  similar: SimilarOpportunity[];
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [savePending, setSavePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        ? await fetchWithTimeout("/api/opportunities/save?opportunity_id=" + opportunity.id, { method: "DELETE" })
        : await fetchWithTimeout("/api/opportunities/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opportunity_id: opportunity.id }),
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

  return (
    <div>
      <BackLink href="/opportunities" label="Back to opportunities" />
      <div className="bg-white rounded-2xl border border-hairline shadow-card p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <ProviderMonogram name={opportunity.provider_name} size={64} />
          <div className="min-w-0 flex-1">
            <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full mb-2 ${TYPE_TONE[opportunity.type]}`}>
              {TYPE_LABELS[opportunity.type]}
            </span>
            <h1 className="font-display text-2xl font-semibold text-navy leading-snug">{opportunity.title}</h1>
            <p className="text-sm text-navy-light mt-1">{opportunity.provider_name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <DeadlineBadge deadline={opportunity.deadline} />
          {opportunity.compensation && (
            <span className="text-xs font-mono font-medium text-emerald bg-emerald-light px-2 py-1 rounded-full">
              {opportunity.compensation}
            </span>
          )}
          {opportunity.duration && <span className="text-xs text-navy-light">{opportunity.duration}</span>}
          {opportunity.location && <span className="text-xs text-navy-light">&middot; {opportunity.location}</span>}
          {opportunity.discipline && <span className="text-xs text-navy-light">&middot; {opportunity.discipline}</span>}
        </div>
        {opportunity.description && (
          <p className="text-sm text-ink leading-relaxed mb-6 mt-4">{opportunity.description}</p>
        )}
        {opportunity.eligibility_notes && (
          <div className="mb-6">
            <h2 className="font-display text-lg font-semibold text-navy mb-2">Eligibility notes</h2>
            <p className="text-sm text-ink leading-relaxed">{opportunity.eligibility_notes}</p>
          </div>
        )}
        {actionError && <p className="text-sm text-rose mb-4" role="alert">{actionError}</p>}
        <div className="flex flex-wrap items-center gap-3 mb-8 pb-8 border-b border-hairline">
          {opportunity.application_url && (
            <a
              href={opportunity.application_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors"
            >
              Apply on provider&apos;s site &rarr;
            </a>
          )}
          {opportunity.how_to_apply && !opportunity.application_url && (
            <div className="bg-navy-50 rounded-xl p-4 w-full">
              <p className="text-sm text-ink leading-relaxed">
                <span className="font-medium text-navy">How to apply:</span> {opportunity.how_to_apply}
              </p>
            </div>
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
          <ShareButton variant="full" opportunityId={opportunity.id} title={opportunity.title} sharerId={sharerId} />
        </div>
      </div>
      {similar.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-navy mb-4">Similar opportunities</h2>
          <div className="grid gap-3">
            {similar.map((s) => (
              <Link
                key={s.id}
                href={`/opportunities/${s.id}`}
                className="bg-white rounded-xl border border-hairline p-4 flex items-center gap-4 shadow-card hover:border-navy/30 transition-colors"
              >
                <ProviderMonogram name={s.provider_name} size={44} />
                <div className="min-w-0 flex-1">
                  <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full mb-1 ${TYPE_TONE[s.type]}`}>
                    {TYPE_LABELS[s.type]}
                  </span>
                  <p className="font-medium text-ink text-sm leading-snug">{s.title}</p>
                  <p className="text-xs text-navy-light mt-0.5">{s.provider_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <DeadlineBadge deadline={s.deadline} />
                    {s.compensation && <span className="text-xs font-mono text-emerald">{s.compensation}</span>}
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
