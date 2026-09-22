"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { MatchSeal } from "@/components/MatchSeal";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";
import { saveReturnScroll } from "@/lib/scrollRestore";
import { daysUntil, formatDeadlineLabel } from "@/lib/dates";
import type { CardScholarship } from "@/components/ScholarshipCard";
import type { ScholarshipMatch } from "@/lib/matching/types";

type FreshMatch = ScholarshipMatch & CardScholarship;
type PlannerSection = "urgent" | "strongest" | "attention";

function requirementSummary(match: FreshMatch): string {
  const metLabels = match.requirements
    .filter((requirement) => requirement.status === "met")
    .map((requirement) => requirement.label)
    .slice(0, 2);
  if (metLabels.length > 0) return `Matches your ${metLabels.join(" and ").toLowerCase()}`;
  if (match.discipline) return `Relevant to ${match.discipline.toLowerCase()}`;
  if (match.level === "both") return "Open to undergraduate and postgraduate students";
  return `Available for ${match.level} students`;
}

function missingSummary(match: FreshMatch): string | null {
  const missing = match.requirements
    .filter((requirement) => requirement.status === "missing_data")
    .map((requirement) => requirement.label)
    .slice(0, 2);
  return missing.length > 0 ? `Add ${missing.join(" and ").toLowerCase()} to confirm your fit.` : null;
}

function nextAction(match: FreshMatch, section: PlannerSection): string {
  if (section === "urgent") return "Review requirements and apply soon";
  if (match.missingProfileFields.length > 0 || missingSummary(match)) return "Complete your profile first";
  if (match.tier === "excellent") return "Review and shortlist this match";
  return "Open details and decide";
}

function SaveButton({ saved, pending, onToggle }: { saved: boolean; pending: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-label={saved ? "Remove from saved scholarships" : "Save scholarship"}
      aria-pressed={saved}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${saved ? "border-emerald/30 bg-emerald-light text-emerald" : "border-hairline bg-white text-navy-light hover:border-navy/30 hover:text-navy"}`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function PlannerRow({
  match,
  section,
  saved,
  pending,
  onToggleSave,
}: {
  match: FreshMatch;
  section: PlannerSection;
  saved: boolean;
  pending: boolean;
  onToggleSave: () => void;
}) {
  const days = daysUntil(match.deadline);
  const missing = missingSummary(match);
  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(11,30,61,0.03)]">
      <div className="flex items-start gap-3">
        <MatchSeal score={match.score} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/scholarships/${match.id}`} onClick={saveReturnScroll} className="block font-medium leading-snug text-ink hover:text-navy hover:underline">
                {match.title}
              </Link>
              <p className="mt-0.5 text-xs text-navy-light">{match.provider_name}</p>
            </div>
            <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
          </div>
          <p className="mt-3 text-sm text-navy">{requirementSummary(match)}</p>
          {missing && <p className="mt-1.5 text-xs text-amber">{missing}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {days !== null && <DeadlineBadge deadline={match.deadline} />}
            <span className="rounded-full bg-navy-50 px-2 py-1 text-xs text-navy-light">{nextAction(match, section)}</span>
            {match.amount && <span className="text-xs font-mono text-emerald">{match.amount}</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-3">
        <p className="text-xs text-navy-light">
          {section === "urgent" && days !== null ? `${formatDeadlineLabel(days)} — prioritize this review` : `${match.tier === "excellent" ? "Excellent" : match.tier === "good" ? "Strong" : "Possible"} fit`}
        </p>
        <Link href={`/scholarships/${match.id}`} onClick={saveReturnScroll} className="shrink-0 text-xs font-medium text-navy hover:underline">
          View full details &rarr;
        </Link>
      </div>
    </div>
  );
}

function PlannerSection({ title, description, matches, section, savedIds, pendingIds, onToggleSave }: {
  title: string;
  description: string;
  matches: FreshMatch[];
  section: PlannerSection;
  savedIds: Set<string>;
  pendingIds: Set<string>;
  onToggleSave: (id: string) => void;
}) {
  if (matches.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="font-display text-xl font-semibold text-navy">{title}</h2>
        <p className="mt-1 text-sm text-navy-light">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {matches.map((match) => (
          <PlannerRow key={`${section}-${match.id}`} match={match} section={section} saved={savedIds.has(match.id)} pending={pendingIds.has(match.id)} onToggleSave={() => onToggleSave(match.id)} />
        ))}
      </div>
    </section>
  );
}

export function FreshMatchesClient({
  initialMatches,
  initialSavedIds,
  initialError,
}: {
  initialMatches: FreshMatch[];
  initialSavedIds: string[];
  initialError: string | null;
}) {
  const [savedIds, setSavedIds] = useState(() => new Set(initialSavedIds));
  const [pendingIds, setPendingIds] = useState(() => new Set<string>());

  const plan = useMemo(() => {
    const urgent: FreshMatch[] = [];
    const attention: FreshMatch[] = [];
    const strongest: FreshMatch[] = [];
    const assigned = new Set<string>();

    for (const match of initialMatches) {
      const days = daysUntil(match.deadline);
      if (days !== null && days >= 0 && days <= 7) {
        urgent.push(match);
        assigned.add(match.id);
      }
    }
    for (const match of initialMatches) {
      if (assigned.has(match.id)) continue;
      if (match.missingProfileFields.length > 0 || match.requirements.some((requirement) => requirement.status === "missing_data")) {
        attention.push(match);
        assigned.add(match.id);
      }
    }
    for (const match of initialMatches) {
      if (!assigned.has(match.id)) strongest.push(match);
    }
    urgent.sort((a, b) => (daysUntil(a.deadline) ?? 999) - (daysUntil(b.deadline) ?? 999));
    attention.sort((a, b) => b.score - a.score);
    strongest.sort((a, b) => b.score - a.score);
    return { urgent, attention, strongest };
  }, [initialMatches]);

  async function toggleSave(scholarshipId: string) {
    const wasSaved = savedIds.has(scholarshipId);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(scholarshipId);
      else next.add(scholarshipId);
      return next;
    });
    setPendingIds((current) => new Set(current).add(scholarshipId));
    try {
      const response = wasSaved
        ? await fetchWithTimeout(`/api/scholarships/save?scholarship_id=${scholarshipId}`, { method: "DELETE" })
        : await fetchWithTimeout("/api/scholarships/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scholarship_id: scholarshipId }) });
      if (!response.ok) throw new Error("save failed");
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(scholarshipId);
        else next.delete(scholarshipId);
        return next;
      });
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(scholarshipId);
        return next;
      });
    }
  }

  const reviewCount = initialMatches.length;
  const urgentCount = plan.urgent.length;
  const attentionCount = plan.attention.length;

  return (
    <div>
      <Link href="/dashboard" onClick={saveReturnScroll} className="text-sm font-medium text-navy-light hover:text-navy">&larr; Back to dashboard</Link>
      <div className="mt-6 mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-navy-light">Fresh matches</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-navy">Your review planner</h1>
        <p className="mt-2 max-w-2xl text-sm text-navy-light">A practical shortlist of what to review first, why each scholarship fits you, and what to do next.</p>
      </div>
      {initialError && <StatusMessage tone="error" className="mb-6">{initialError}</StatusMessage>}
      {reviewCount === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-8 text-center">
          <p className="text-sm text-navy-light">Complete a few profile fields to unlock fresh matches.</p>
          <Link href="/onboarding" className="mt-4 inline-flex text-sm font-medium text-navy hover:underline">Finish your profile &rarr;</Link>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-navy p-4 text-white"><p className="font-mono text-2xl font-semibold">{reviewCount}</p><p className="mt-1 text-xs text-white/70">to review</p></div>
            <div className="rounded-2xl border border-hairline bg-white p-4"><p className="font-mono text-2xl font-semibold text-rose">{urgentCount}</p><p className="mt-1 text-xs text-navy-light">this week</p></div>
            <div className="rounded-2xl border border-hairline bg-white p-4"><p className="font-mono text-2xl font-semibold text-amber">{attentionCount}</p><p className="mt-1 text-xs text-navy-light">need attention</p></div>
          </div>
          <PlannerSection title="Act this week" description="These matches have deadlines within seven days. Review them before browsing anything else." matches={plan.urgent} section="urgent" savedIds={savedIds} pendingIds={pendingIds} onToggleSave={toggleSave} />
          <PlannerSection title="Needs your attention" description="Your profile is missing information needed to confirm these matches." matches={plan.attention} section="attention" savedIds={savedIds} pendingIds={pendingIds} onToggleSave={toggleSave} />
          <PlannerSection title="Strongest matches" description="Good opportunities to shortlist after the urgent items are handled." matches={plan.strongest} section="strongest" savedIds={savedIds} pendingIds={pendingIds} onToggleSave={toggleSave} />
        </>
      )}
    </div>
  );
}
