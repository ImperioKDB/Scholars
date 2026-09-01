"use client";

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
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  application_url: string | null;
  how_to_apply?: string | null;
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

// Card title/avatar/badges are wrapped in a Link to /scholarships/[id]
// via `className="contents"` so the wrapper doesn't affect the existing
// flex layout. ShareButton and SaveButton are siblings, absolutely
// positioned in the top-right corner -- NOT nested inside the Link, since
// a <button> inside an <a> is invalid HTML and would break keyboard/
// screen-reader semantics. ShareButton calls stopPropagation/
// preventDefault internally so tapping it never also triggers the card's
// own Link navigation underneath. pr-14 (was pr-8) makes room for the
// second icon now sitting in that corner.
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
  // Current user's profile id, threaded down from the page-level Server
  // Component so a generated share link carries ?ref=<sharerId> for
  // referral attribution (middleware.ts + app/auth/callback/route.ts).
  // Optional so this component doesn't break wherever it hasn't been
  // wired through yet -- the share icon simply doesn't render without it.
  sharerId?: string;
}) {
  return (
    <div className="relative bg-white rounded-xl border border-hairline p-5 flex gap-4 shadow-card">
      <Link href={`/scholarships/${scholarship.id}`} className="contents">
        {score !== undefined ? (
          <MatchSeal score={score} size={52} />
        ) : (
          <ProviderMonogram name={scholarship.provider_name} size={52} />
        )}

        <div className="min-w-0 flex-1">
          <div className="pr-14">
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
            <p className="text-xs text-amber mt-1.5">
              Missing: {missingLabels.join(", ")}
            </p>
          )}
        </div>
      </Link>

      <div className="absolute top-5 right-5 flex items-center gap-1">
        {sharerId && (
          <ShareButton
            variant="icon"
            scholarshipId={scholarship.id}
            title={scholarship.title}
            sharerId={sharerId}
          />
        )}
        <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
      </div>
    </div>
  );
}
