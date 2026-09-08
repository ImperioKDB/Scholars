"use client";
import { useState } from "react";
import Link from "next/link";
import { MatchSeal } from "@/components/MatchSeal";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { ShareButton } from "@/components/ShareButton";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { saveReturnScroll } from "@/lib/scrollRestore";
import { daysUntil, formatLastClosedLabel, formatOpensLabel } from "@/lib/dates";

export type CardScholarship = {
  id: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  opens_at?: string | null;
  last_cycle_closed_at?: string | null;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  application_url: string | null;
  how_to_apply?: string | null;
  isOpenNow?: boolean;
  isTrending?: boolean;
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// MOTION/FEEDBACK (item 1): one-shot scale spring on save/unsave. The
// save-pop keyframes (app/motion.css) carry the overshoot; cleared by
// onAnimationEnd so rapid re-taps re-trigger it. Reduced motion disables
// the animation in motion.css.
function SaveButton({ saved, pending, onToggle }: { saved: boolean; pending?: boolean; onToggle: () => void }) {
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setPop(true);
        onToggle();
      }}
      onAnimationEnd={() => setPop(false)}
      disabled={pending}
      aria-label={saved ? "Remove from saved scholarships" : "Save scholarship"}
      aria-pressed={saved}
      className={[
        "relative shrink-0 rounded-full p-1.5 bg-white/90 backdrop-blur-sm transition-colors disabled:opacity-50",
        "after:absolute after:-inset-[7px] after:rounded-full after:content-['']",
        saved ? "text-emerald" : "text-navy-light hover:text-navy",
        pop ? "save-pop" : "",
      ].join(" ")}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ScholarshipCard({
  scholarship,
  score,
  metCount,
  totalCount,
  missingLabels,
  saved,
  onToggleSave,
  pending,
  sharerId,
}: {
  scholarship: CardScholarship;
  score?: number;
  metCount?: number;
  totalCount?: number;
  missingLabels?: string[];
  saved: boolean;
  onToggleSave: () => void;
  pending?: boolean;
  sharerId?: string;
}) {
  const opensIn = scholarship.opens_at ? daysUntil(scholarship.opens_at) : null;
  const opensSoon = scholarship.isOpenNow === false && opensIn !== null && opensIn > 0;
  const closedUnknownReopen =
    scholarship.isOpenNow === false && !opensSoon && Boolean(scholarship.last_cycle_closed_at);
  return (
    // WHOLE-CARD TAP: the link is a stretched overlay (absolute inset-0)
    // so every part of the card navigates, not just the inner content.
    // Save/Share sit at z-10 above the overlay so they stay independently
    // clickable. Press feedback scales the whole card via has-[a:active].
    <div className="relative bg-white rounded-xl border border-hairline p-5 flex flex-col gap-4 sm:flex-row shadow-card focus-within:ring-2 focus-within:ring-emerald focus-within:ring-offset-2 focus-within:ring-offset-parchment transition-transform duration-150 motion-reduce:transition-none has-[a:active]:scale-[0.99] motion-reduce:has-[a:active]:scale-100">
      {/* RETURN-SCROLL: record the list's scroll offset at tap time so
          "Back to matches" can restore it (see lib/scrollRestore.ts). */}
      <Link
        href={`/scholarships/${scholarship.id}`}
        onClick={saveReturnScroll}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`View ${scholarship.title}`}
      />
      {score !== undefined ? (
        <MatchSeal score={score} size={52} />
      ) : (
        <ProviderMonogram name={scholarship.provider_name} size={52} />
      )}
      <div className="min-w-0 flex-1">
        <div className="sm:pr-24">
          <p className="font-medium text-ink leading-snug">{scholarship.title}</p>
          <p className="text-xs text-navy-light mt-0.5">{scholarship.provider_name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {opensSoon ? (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-light text-amber">
              {formatOpensLabel(scholarship.opens_at as string)}
            </span>
          ) : closedUnknownReopen ? (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-light text-amber">
              {formatLastClosedLabel(scholarship.last_cycle_closed_at as string)}
            </span>
          ) : (
            <DeadlineBadge deadline={scholarship.deadline} />
          )}
          {scholarship.isOpenNow && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-light text-emerald">Open now</span>
          )}
          {scholarship.isTrending && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-light text-amber">Trending</span>
          )}
          {scholarship.amount && <span className="text-xs font-mono text-emerald">{scholarship.amount}</span>}
          <span className="text-xs text-navy-light capitalize">
            {scholarship.level === "both" ? "Undergrad & postgrad" : scholarship.level}
          </span>
          {scholarship.discipline && <span className="text-xs text-navy-light">&middot; {scholarship.discipline}</span>}
        </div>
        {totalCount !== undefined && totalCount > 0 && (
          <p className="text-xs text-navy-light mt-2 font-mono">{metCount}/{totalCount} requirements met</p>
        )}
        {missingLabels && missingLabels.length > 0 && (
          <p className="text-xs text-amber mt-1.5">Missing: {missingLabels.join(", ")}</p>
        )}
      </div>
      <div className="absolute top-5 right-5 z-10 flex items-center gap-3.5">
        {sharerId && (
          <ShareButton variant="icon" scholarshipId={scholarship.id} title={scholarship.title} sharerId={sharerId} />
        )}
        <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
      </div>
    </div>
  );
}
