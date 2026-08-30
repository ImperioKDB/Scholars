"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MatchSeal } from "@/components/MatchSeal";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";

// Deliberately narrow: this is the subset of a scholarship both
// ScholarshipMatch (from /api/scholarships/match) and the saved-scholarship
// shape (from /api/scholarships/save) share. Both are passed in as variables
// (not object literals), so TS structural typing allows the extra fields
// each one carries without a cast.
export type CardScholarship = {
  id: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  application_url: string | null;
};

const DEADLINE_TONE_CLASSES: Record<ReturnType<typeof deadlineTone>, string> = {
  closed: "bg-hairline text-navy-light",
  urgent: "bg-rose-light text-rose",
  soon: "bg-amber-light text-amber",
  later: "bg-navy-50 text-navy-light",
};

// How long a tap has to keep loading before we bother showing a spinner.
// Under this, the navigation just completes and the card unmounts -- no
// point flashing a loading indicator for something that resolved instantly.
const SPINNER_DELAY_MS = 150;

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const days = daysUntil(deadline);
  if (days === null) return null;

  return (
    <span
      className={`text-xs font-mono font-medium px-2 py-1 rounded-full ${DEADLINE_TONE_CLASSES[deadlineTone(days)]}`}
    >
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
      aria-label={saved ? "Remove from saved scholarships" : "Save scholarship"}
      aria-pressed={saved}
      className={[
        "shrink-0 rounded-full p-1.5 bg-white/90 backdrop-blur-sm transition-colors disabled:opacity-50",
        saved ? "text-emerald" : "text-navy-light hover:text-navy",
      ].join(" ")}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// Small spinner reusing the exact markup already used on the login/signup
// submit buttons, so a loading state looks the same everywhere in the app
// rather than introducing a second visual language for "busy."
export function Spinner({ className = "h-5 w-5 text-navy" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Card title/avatar/badges are wrapped in a Link to /scholarships/[id]
// (the detail page) via `className="contents"` so the wrapper doesn't
// affect the existing flex layout. SaveButton is a sibling, absolutely
// positioned in the top-right corner -- NOT nested inside the Link,
// since a <button> inside an <a> is invalid HTML and would break
// keyboard/screen-reader semantics. The external "View application"
// link that used to live here was removed -- the detail page's "Apply on
// provider's site" button is now the one place that sends someone to the
// external URL, so a card never has two competing tap targets.
//
// Press/loading feedback: `navigating` is set the instant the Link is
// clicked (not on SaveButton, which is a sibling and never triggers it),
// and only cleared by this component unmounting -- which is exactly what
// happens once the App Router swaps in the detail page, so there's
// nothing to reset on success. The outer card scales down and dims
// immediately (zero perceived delay, since it's a synchronous state
// update rendered on the next paint); the spinner overlay only appears
// after SPINNER_DELAY_MS so a fast/prefetched navigation never flashes
// a loading indicator for no reason. `active:scale-[0.99]` on the same
// element gives an even earlier, browser-native press cue for the
// instant between finger-down and the click event actually firing.
export function ScholarshipCard({
  scholarship,
  score,
  metCount,
  totalCount,
  missingLabels,
  saved,
  onToggleSave,
  pending,
}: {
  scholarship: CardScholarship;
  score?: number;
  metCount?: number;
  totalCount?: number;
  missingLabels?: string[];
  saved: boolean;
  onToggleSave: () => void;
  pending?: boolean;
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

  return (
    <div
      className={[
        "relative bg-white rounded-xl border border-hairline p-5 flex gap-4 shadow-card",
        "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
        "active:scale-[0.99]",
        navigating ? "scale-[0.98] opacity-80" : "scale-100 opacity-100",
      ].join(" ")}
    >
      <Link href={`/scholarships/${scholarship.id}`} className="contents" onClick={handleNavigate}>
        {score !== undefined ? (
          <MatchSeal score={score} size={52} />
        ) : (
          <ProviderMonogram name={scholarship.provider_name} size={52} />
        )}

        <div className="min-w-0 flex-1">
          <div className="pr-8">
            <p className="font-medium text-ink leading-snug hover:text-navy transition-colors">{scholarship.title}</p>
            <p className="text-xs text-navy-light mt-0.5">{scholarship.provider_name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <DeadlineBadge deadline={scholarship.deadline} />
            {scholarship.amount && <span className="text-xs font-mono text-emerald">{scholarship.amount}</span>}
            <span className="text-xs text-navy-light capitalize">
              {scholarship.level === "both" ? "Undergrad & postgrad" : scholarship.level}
            </span>
            {scholarship.discipline && <span className="text-xs text-navy-light">&middot; {scholarship.discipline}</span>}
          </div>

          {totalCount !== undefined && totalCount > 0 && (
            <p className="text-xs text-navy-light mt-2 font-mono">
              {metCount}/{totalCount} requirements met
            </p>
          )}

          {missingLabels && missingLabels.length > 0 && (
            <p className="text-xs text-amber mt-1.5">Add {missingLabels.join(", ").toLowerCase()} to strengthen this match</p>
          )}
        </div>
      </Link>

      <div className="absolute top-5 right-5">
        <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
      </div>

      {showSpinner && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px] pointer-events-none transition-opacity duration-150 motion-reduce:transition-none"
          aria-hidden="true"
        >
          <Spinner />
        </div>
      )}
    </div>
  );
}
