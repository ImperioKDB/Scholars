// lib/matching/gaps.ts
//
// Gap-closing nudges. The matching engine already tells us, per
// scholarship, which requirements couldn't be checked because a profile
// field is missing (`missing_data` -- see engine.ts). An unfilled field
// also actively lowers that scholarship's score today, because
// `missing_data` requirements count in the denominator but never the
// numerator (evaluateScholarship in engine.ts).
//
// This module turns that into an honest, concrete nudge: for each missing
// field, simulate "what if this one requirement were met" and count how
// many scholarships would cross into a strictly better tier. That's a real
// number grounded in the student's actual matches, not a guess -- if
// filling in WAEC results wouldn't move anything, it won't get suggested.
//
// Deliberately optimistic in one direction only: the simulation assumes
// the filled-in value WOULD satisfy the requirement. It never assumes the
// opposite (a filled-in value failing a requirement), because a gating
// field that's currently `missing_data` isn't currently failing gating
// either -- so the simulation can only ever show improvement, matching
// what "unlock" honestly promises.

import { tierFor } from "./engine";
import type { MatchTier, ScholarshipMatch } from "./types";

export type GapNudge = {
  field: string;
  label: string;
  scholarshipCount: number;
  onboardingStep: number;
};

const TIER_RANK: Record<MatchTier, number> = {
  unlikely: 0,
  possible: 1,
  good: 2,
  excellent: 3,
};

// Which onboarding step (see app/onboarding/page.tsx STEPS) collects each
// field, so a nudge can deep-link straight to the right step instead of
// dropping the student on step 0 every time.
const FIELD_TO_ONBOARDING_STEP: Record<string, number> = {
  nationality: 0,
  gender: 0,
  state_of_origin: 0,
  lga_of_origin: 0,
  age: 0, // collected as date_of_birth on step 0
  discipline: 1,
  gpa: 1,
  year_of_study: 1,
  institution_type: 1, // collected via institution selection on step 1
  financial_need: 2,
  jamb_score: 2,
  waec_credit_count: 2,
  has_english_maths_credit: 2,
  disability_status: 2,
};

// Pure function over already-computed matches -- no DB access, so it's
// cheap to call right after getMatchesForCurrentUser() and easy to test.
export function computeProfileGaps(matches: ScholarshipMatch[]): GapNudge[] {
  const byField = new Map<string, { label: string; scholarshipIds: Set<string> }>();

  for (const match of matches) {
    const evaluable = match.requirements.filter((r) => r.status !== "unverifiable");
    if (evaluable.length === 0) continue;

    const metCount = evaluable.filter((r) => r.status === "met").length;
    const gatingFailed = evaluable.some((r) => r.gating && r.status === "not_met");
    const currentTierRank = TIER_RANK[match.tier];

    const missing = evaluable.filter((r) => r.status === "missing_data");
    if (missing.length === 0) continue;

    // Each missing requirement simulated independently -- "if only this
    // one were filled in", not "if all of them were". Filling in several
    // real fields at once can only do at least as well as the best single
    // simulation here, so this stays a conservative (never overstated)
    // count.
    for (const req of missing) {
      const hypotheticalScore = Math.round(((metCount + 1) / evaluable.length) * 100);
      const hypotheticalTier = tierFor(hypotheticalScore, gatingFailed);

      if (TIER_RANK[hypotheticalTier] > currentTierRank) {
        const entry = byField.get(req.field) ?? { label: req.label, scholarshipIds: new Set<string>() };
        entry.scholarshipIds.add(match.id);
        byField.set(req.field, entry);
      }
    }
  }

  return Array.from(byField.entries())
    .map(([field, { label, scholarshipIds }]) => ({
      field,
      label,
      scholarshipCount: scholarshipIds.size,
      onboardingStep: FIELD_TO_ONBOARDING_STEP[field] ?? 0,
    }))
    .filter((g) => g.scholarshipCount > 0)
    .sort((a, b) => b.scholarshipCount - a.scholarshipCount);
}
