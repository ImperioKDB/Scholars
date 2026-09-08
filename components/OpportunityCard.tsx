"use client";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";

export type CardOpportunity = {
  id: string;
  type: "fellowship" | "internship" | "competition" | "mentorship";
  title: string;
  provider_name: string;
  description: string | null;
  duration: string | null;
  location: string | null;
  compensation: string | null;
  discipline: string | null;
  deadline: string | null;
  application_url: string | null;
  how_to_apply: string | null;
};

const TYPE_LABELS: Record<CardOpportunity["type"], string> = {
  fellowship: "Fellowship",
  internship: "Internship",
  competition: "Competition",
  mentorship: "Mentorship",
};

const TYPE_TONE: Record<CardOpportunity["type"], string> = {
  fellowship: "bg-navy-50 text-navy",
  internship: "bg-emerald-light text-emerald",
  competition: "bg-amber-light text-amber",
  mentorship: "bg-rose-light text-rose",
};

const DEADLINE_TONE_CLASSES: Record<ReturnType<typeof deadlineTone>, string> = {
  closed: "bg-hairline text-navy-light",
  urgent: "bg-rose-light text-rose",
  soon: "bg-amber-light text-amber",
  later: "bg-navy-50 text-navy-light",
};

function DeadlineOrRolling({ deadline }: { deadline: string | null }) {
  if (!deadline) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded-full bg-navy-50 text-navy-light">
        Rolling / no deadline
      </span>
    );
  }
  const days = daysUntil(deadline);
  if (days === null) return null;
  return (
    <span className={`text-xs font-mono font-medium px-2 py-1 rounded-full ${DEADLINE_TONE_CLASSES[deadlineTone(days)]}`}>
      {formatDeadlineLabel(days)}
    </span>
  );
}

function SaveButton({
  saved,
  pending,
  onToggle,
}: {
  saved: boolean;
  pending?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-label={saved ? "Remove from saved opportunities" : "Save opportunity"}
      aria-pressed={saved}
      className={[
        "relative shrink-0 rounded-full p-1.5 bg-white/90 backdrop-blur-sm transition-colors disabled:opacity-50",
        "after:absolute after:-inset-[7px] after:rounded-full after:content-['']",
        saved ? "text-emerald" : "text-navy-light hover:text-navy",
      ].join(" ")}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function OpportunityCard({
  opportunity,
  saved,
  onToggleSave,
  pending,
}: {
  opportunity: CardOpportunity;
  saved: boolean;
  onToggleSave: () => void;
  pending?: boolean;
}) {
  const applyHref = opportunity.application_url;
  return (
    <div className="relative bg-white rounded-xl border border-hairline p-5 flex flex-col gap-4 sm:flex-row shadow-card">
      <ProviderMonogram name={opportunity.provider_name} size={52} />
      <div className="min-w-0 flex-1 sm:pr-10">
        <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full mb-2 ${TYPE_TONE[opportunity.type]}`}>
          {TYPE_LABELS[opportunity.type]}
        </span>
        <p className="font-medium text-ink leading-snug">{opportunity.title}</p>
        <p className="text-xs text-navy-light mt-0.5">{opportunity.provider_name}</p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <DeadlineOrRolling deadline={opportunity.deadline} />
          {opportunity.compensation && (
            <span className="text-xs font-mono text-emerald">{opportunity.compensation}</span>
          )}
          {opportunity.location && <span className="text-xs text-navy-light">&middot; {opportunity.location}</span>}
          {opportunity.discipline && <span className="text-xs text-navy-light">&middot; {opportunity.discipline}</span>}
        </div>
        {opportunity.description && (
          <p className="text-sm text-navy-light mt-2 line-clamp-2">{opportunity.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3">
          {applyHref ? (
            <a
              href={applyHref}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors"
            >
              Apply &rarr;
            </a>
          ) : opportunity.how_to_apply ? (
            <p className="text-xs text-navy-light leading-relaxed">
              <span className="font-medium text-ink">How to apply: </span>
              {opportunity.how_to_apply}
            </p>
          ) : null}
        </div>
      </div>
      <div className="absolute top-5 right-5">
        <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
      </div>
    </div>
  );
}
