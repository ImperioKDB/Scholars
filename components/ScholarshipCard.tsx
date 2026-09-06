"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MatchSeal } from "@/components/MatchSeal";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { ShareButton } from "@/components/ShareButton";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";

export type CardScholarship = {
  id: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  opens_at?: string | null;
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

const DEADLINE_TONE_CLASSES: Record<ReturnType<typeof deadlineTone>, string> = {
  closed: "bg-hairline text-navy-light",
  urgent: "bg-rose-light text-rose",
  soon: "bg-amber-light text-amber",
  later: "bg-navy-50 text-navy-light",
};

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const days = daysUntil(deadline);
  if (days === null) return null;
  return (
    <span className={`text-xs font-mono font-medium px-2 py-1 rounded-full ${DEADLINE_TONE_CLASSES[deadlineTone(days)]}`}>
      {formatDeadlineLabel(days)}
    </span>
  );
}

function SaveButton({ saved, pending, onToggle }: { saved: boolean; pending?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-label={saved ? "Remove from saved scholarships" : "Save scholarship"}
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

// CLICK FEEL (live feedback): the Link was display:contents, which has no
// box, so :active could never animate it and a slow server read as "nothing
// happened." The Link is now a real flex box that presses (active:scale)
// and, if navigation takes >150ms, shows a dim + spinner overlay so the
// wait always reads as "loading," never as "dead."
const SPINNER_DELAY_MS = 150;

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
  const [navigating, setNavigating] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const spinnerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (spinnerTimeout.current) clearTimeout(spinnerTimeout.current);
    };
  }, []);

  function handleNavigate() {
    setNavigating(true);
    spinnerTimeout.current = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
  }

  const opensIn = scholarship.opens_at ? daysUntil(scholarship.opens_at) : null;
  const opensSoon = scholarship.isOpenNow === false && opensIn !== null && opensIn > 0;

  return (
    <div className="relative bg-white rounded-xl border border-hairline p-5 shadow-card focus-within:ring-2 focus-within:ring-emerald focus-within:ring-offset-2 focus-within:ring-offset-parchment">
      <Link
        href={`/scholarships/${scholarship.id}`}
        onClick={handleNavigate}
        className={[
          "flex flex-col gap-4 sm:flex-row rounded-xl",
          "transition-transform duration-150 motion-reduce:transition-none",
          "active:scale-[0.98] motion-reduce:active:scale-100",
          navigating ? "scale-[0.98] opacity-80" : "",
        ].join(" ")}
      >
        {score !== undefined ? (
          <MatchSeal score={score} size={52} />
        ) : (
          <ProviderMonogram name={scholarship.provider_name} size={52} />
        )}
        <div className="min-w-0 flex-1">
          <div className="sm:pr-24">
            <p className="font-medium text-ink leading-snug hover:text-navy transition-colors">{scholarship.title}</p>
            <p className="text-xs text-navy-light mt-0.5">{scholarship.provider_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {opensSoon ? (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-light text-amber">
                Opens in {opensIn} day{opensIn === 1 ? "" : "s"}
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
      </Link>
      <div className="absolute top-5 right-5 flex items-center gap-3.5">
        {sharerId && (
          <ShareButton variant="icon" scholarshipId={scholarship.id} title={scholarship.title} sharerId={sharerId} />
        )}
        <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
      </div>
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px] pointer-events-none">
          <Spinner className="h-4 w-4 text-navy" />
        </div>
      )}
    </div>
  );
}
