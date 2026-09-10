"use client";
import Link from "next/link";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { ShareButton } from "@/components/ShareButton";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";
import { saveReturnScroll } from "@/lib/scrollRestore";

export type CardOpportunity = {
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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
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
  sharerId,
}: {
  opportunity: CardOpportunity;
  saved: boolean;
  onToggleSave: () => void;
  pending?: boolean;
  sharerId?: string;
}) {
  return (
    // WHOLE-CARD TAP: the link is a stretched overlay (absolute inset-0)
    // so every part of the card navigates to the detail page, not just the
    // inner content. Save/Share sit at z-10 above the overlay so they stay
    // independently clickable. Press feedback scales the whole card.
    <div className="relative bg-white rounded-xl border border-hairline p-5 flex flex-col gap-4 sm:flex-row shadow-card focus-within:ring-2 focus-within:ring-emerald focus-within:ring-offset-2 focus-within:ring-offset-parchment transition-transform duration-150 motion-reduce:transition-none has-[a:active]:scale-[0.99] motion-reduce:has-[a:active]:scale-100">
      <Link
        href={`/opportunities/${opportunity.id}`}
        onClick={saveReturnScroll}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`View ${opportunity.title}`}
      />
      <ProviderMonogram name={opportunity.provider_name} size={52} />
      <div className="min-w-0 flex-1 sm:pr-24">
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
      </div>
      {/* Same corner arrangement as ScholarshipCard: share + save sit at
          z-10 over the card, with the ShareButton's ::after hit area
          (44px tap target) kept clear of the save button by gap-3.5. */}
      <div className="absolute top-5 right-5 z-10 flex items-center gap-3.5">
        {sharerId && (
          <ShareButton
            variant="icon"
            opportunityId={opportunity.id}
            title={opportunity.title}
            sharerId={sharerId}
          />
        )}
        <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
      </div>
    </div>
  );
}
