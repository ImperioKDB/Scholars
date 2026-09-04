"use client";

import { useState } from "react";
import Link from "next/link";

// components/RequirementsList.tsx
//
// Replaces the old flat <ul> of eligibility requirements. That version gave
// every requirement -- met, not-met, missing-data -- identical visual
// weight in whatever order the matching engine returned them, so a
// scholarship with a long discipline list (see lib/data/courses.ts) could
// push the one actionable thing (missing profile fields) several
// screenfuls down. This groups by status so the actionable group comes
// first, gives all "missing from your profile" items ONE shared CTA
// instead of a repeated pill per row, and truncates long requirement
// strings (e.g. "Field of study must be one of: <15 disciplines>") behind
// a "Show all" toggle instead of rendering the full list inline.
//
// Rows also carry a left-border color code per status (emerald = met,
// rose = not met, amber = missing data, hairline = verify with provider)
// on top of the pill -- the product audit flagged that status shouldn't
// require reading the pill text before the eye can scan a long list.

export type RequirementStatus = "met" | "not_met" | "missing_data" | "unverifiable";

export type Requirement = {
  field: string;
  label: string;
  status: RequirementStatus;
  requirement: string;
  detail: string;
};

const REQ_STATUS_TONE: Record<RequirementStatus, string> = {
  met: "bg-emerald-light text-emerald",
  not_met: "bg-rose-light text-rose",
  missing_data: "bg-amber-light text-amber",
  unverifiable: "bg-navy-50 text-navy-light",
};

const REQ_STATUS_LABELS: Record<RequirementStatus, string> = {
  met: "Met",
  not_met: "Not met",
  missing_data: "Add this to your profile",
  unverifiable: "Verify with provider",
};

const REQ_BORDER_TONE: Record<RequirementStatus, string> = {
  met: "border-l-emerald",
  not_met: "border-l-rose",
  missing_data: "border-l-amber",
  unverifiable: "border-l-hairline",
};

// Requirement strings built from long "must be one of: A, B, C..." lists
// (discipline, state_of_origin, etc.) can run past 300 characters. Truncate
// at a length that still fits 2-3 lines on a phone, with an inline toggle
// rather than always rendering the full enumeration.
const TRUNCATE_AT = 90;

function RequirementText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > TRUNCATE_AT;
  const shown = expanded || !isLong ? text : `${text.slice(0, TRUNCATE_AT)}\u2026`;
  return (
    <p className="text-sm font-medium text-ink">
      {shown}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="ml-1.5 text-xs font-medium text-navy hover:underline whitespace-nowrap"
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      )}
    </p>
  );
}

function RequirementRow({ r }: { r: Requirement }) {
  return (
    <li
      className={
        "flex items-start justify-between gap-3 bg-navy-50 rounded-lg p-3.5 border-l-4 " +
        REQ_BORDER_TONE[r.status]
      }
    >
      <div className="min-w-0">
        <RequirementText text={r.requirement} />
        <p className="text-xs text-navy-light mt-0.5">{r.detail}</p>
      </div>
      <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${REQ_STATUS_TONE[r.status]}`}>
        {REQ_STATUS_LABELS[r.status]}
      </span>
    </li>
  );
}

function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <p className="text-xs font-medium text-navy-light uppercase tracking-wide mb-2">
      {title} ({count})
    </p>
  );
}

export function RequirementsList({ requirements }: { requirements: Requirement[] }) {
  const missing = requirements.filter((r) => r.status === "missing_data");
  const notMet = requirements.filter((r) => r.status === "not_met");
  const met = requirements.filter((r) => r.status === "met");
  const unverifiable = requirements.filter((r) => r.status === "unverifiable");
  const checkable = missing.length + notMet.length + met.length;

  if (requirements.length === 0) {
    return (
      <p className="text-sm text-navy-light">
        No specific requirements set for this scholarship yet -- everyone gets a neutral match score.
      </p>
    );
  }

  return (
    <div>
      {checkable > 0 && (
        <div className="mb-5">
          <p className="text-xs text-navy-light mb-1.5">
            {met.length} of {checkable} requirements met
          </p>
          <div className="h-1.5 rounded-full bg-hairline overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald"
              style={{ width: `${Math.round((met.length / checkable) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="mb-6">
          <GroupHeader title="Missing from your profile" count={missing.length} />
          <ul className="space-y-2.5">
            {missing.map((r, i) => (
              <RequirementRow key={`missing-${r.field}-${i}`} r={r} />
            ))}
          </ul>
          <Link
            href="/onboarding"
            className="mt-3 inline-flex items-center gap-1.5 rounded-seal bg-navy text-white text-xs font-medium px-4 py-2 hover:bg-navy-light transition-colors"
          >
            Complete these in your profile
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}

      {notMet.length > 0 && (
        <div className="mb-6">
          <GroupHeader title="Not met" count={notMet.length} />
          <ul className="space-y-2.5">
            {notMet.map((r, i) => (
              <RequirementRow key={`notmet-${r.field}-${i}`} r={r} />
            ))}
          </ul>
        </div>
      )}

      {met.length > 0 && (
        <div className="mb-6">
          <GroupHeader title="Met" count={met.length} />
          <ul className="space-y-2.5">
            {met.map((r, i) => (
              <RequirementRow key={`met-${r.field}-${i}`} r={r} />
            ))}
          </ul>
        </div>
      )}

      {unverifiable.length > 0 && (
        <div>
          <GroupHeader title="Verify with provider" count={unverifiable.length} />
          <ul className="space-y-2.5">
            {unverifiable.map((r, i) => (
              <RequirementRow key={`unverifiable-${r.field}-${i}`} r={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
