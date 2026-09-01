"use client";

import Link from "next/link";
import { MatchSeal } from "@/components/MatchSeal";
import { ProviderMonogram } from "@/components/ProviderMonogram";
import { daysUntil, deadlineTone, formatDeadlineLabel } from "@/lib/dates";

// Deliberately narrow: this is the subset of a scholarship both
// ScholarshipMatch (from /api/scholarships/match) and the saved-scholarship
// shape (from /api/scholarships/save) share. Both are passed in as variables
// (not object literals), so TS structural typing allows the extra fields
// each one carries without a cast.
//
// how_to_apply is optional here (rather than on ScholarshipMatch's required
// field) since cards themselves never render an apply action -- only
// ApplicationsClient's "Open application" link needs it, via the wider
// SCHOLARSHIP_COLUMNS shape it fetches.
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

// DashboardClient.tsx imports this for its per-card navigation-pending
// state (shown briefly over a deadline card while routing to the detail
// page). Same animate-spin circle+path pattern used everywhere else in
// the app (Sidebar's logout spinner, the login/signup submit spinners) --
// centralized here since ScholarshipCard is the module DashboardClient
// already imports scholarship-related pieces from.
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
// (the detail page) via `className="contents"` so the wrapper doesn't
// affect the existing flex layout. SaveButton is a sibling, absolutely
// positioned in the top-right corner -- NOT nested inside the Link,
// since a <button> inside an <a> is invalid HTML and would break
// keyboard/screen-reader semantics. The external "View application"
// link that used to live here was removed -- the detail page's "Apply on
// provider's site" button is now the one place that sends someone to the
// external URL, so a card never has two competing tap targets.
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
  // Short field labels (e.g. "GPA / CGPA", "State of origin") for
  // requirements the engine couldn't check because the profile is missing
  // that data -- DashboardClient.tsx derives this from
  // requirements.filter(r => r.status === "missing_data"). Optional since
  // the Saved-section call site doesn't have per-scholarship requirement
  // data to compute it from.
  missingLabels?: string[];
  saved: boolean;
  onToggleSave: () => void;
  pending?: boolean;
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
            <p className="text-xs text-amber mt-1.5">
              Missing: {missingLabels.join(", ")}
            </p>
          )}
        </div>
      </Link>

      <div className="absolute top-5 right-5">
        <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
      </div>
    </div>
  );
}
