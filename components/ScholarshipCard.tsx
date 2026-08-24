"use client";

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
        "shrink-0 rounded-full p-1.5 transition-colors disabled:opacity-50",
        saved ? "text-emerald" : "text-navy-light hover:text-navy",
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
  saved,
  onToggleSave,
  pending,
}: {
  scholarship: CardScholarship;
  score?: number;
  metCount?: number;
  totalCount?: number;
  saved: boolean;
  onToggleSave: () => void;
  pending?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-hairline p-5 flex gap-4 shadow-card">
      {score !== undefined ? (
        <MatchSeal score={score} size={52} />
      ) : (
        <ProviderMonogram name={scholarship.provider_name} size={52} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-ink leading-snug">{scholarship.title}</p>
            <p className="text-xs text-navy-light mt-0.5">{scholarship.provider_name}</p>
          </div>
          <SaveButton saved={saved} pending={pending} onToggle={onToggleSave} />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <DeadlineBadge deadline={scholarship.deadline} />
          {scholarship.amount && <span className="text-xs font-mono text-emerald">{scholarship.amount}</span>}
          <span className="text-xs text-navy-light capitalize">
            {scholarship.level === "both" ? "Undergrad & postgrad" : scholarship.level}
          </span>
          {scholarship.discipline && <span className="text-xs text-navy-light">· {scholarship.discipline}</span>}
        </div>

        {totalCount !== undefined && totalCount > 0 && (
          <p className="text-xs text-navy-light mt-2 font-mono">
            {metCount}/{totalCount} requirements met
          </p>
        )}

        {scholarship.application_url && (
          <a
            href={scholarship.application_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs font-medium text-navy hover:underline mt-3"
          >
            View application →
          </a>
        )}
      </div>
    </div>
  );
}
