// lib/discovery.ts
//
// "Open now" and "Trending" are two independently, honestly-computed
// signals used to (a) badge scholarship cards and (b) bias display order
// without fully randomizing away eligibility. Neither is fabricated:
//   - Open now: opens_at (admin-set) has passed, and the deadline hasn't.
//     opens_at = null means "no restriction" -- open as soon as verified,
//     so existing rows without this field backfilled don't lose the badge.
//   - Trending: real save velocity from saved_scholarships, computed via
//     get_trending_scholarship_ids() (see migration:
//     add_opens_at_and_trending_fn). Not a synthetic number -- if nobody's
//     saving it, it's not trending.
//
// Display order: matches stay grouped by tier (excellent/good/possible --
// this is load-bearing for the dashboard tabs and lib/matching/gaps.ts),
// but within each tier the order is deterministically shuffled per user
// per day rather than fixed by score, and open+trending cards are pinned
// to the front of their own tier. "Your best matches surface first" stays
// true at the tier level; what you see *inside* a tier varies by day
// instead of being a static score-sorted list that never changes.

import type { ScholarshipMatch } from "./matching/types";

export function isCurrentlyOpen(scholarship: {
  opens_at?: string | null;
  deadline: string | null;
}): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (scholarship.deadline && scholarship.deadline < today) return false;
  if (scholarship.opens_at && scholarship.opens_at > today) return false;
  return true;
}

// Deterministic PRNG so the shuffle is stable for a given seed -- NOT
// Math.random(). A student reloading mid-session shouldn't see cards jump
// around under them; the order should only change day to day.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(userId: string, dayKey: string): number {
  const str = `${userId}:${dayKey}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TIER_ORDER = ["excellent", "good", "possible", "unlikely"] as const;

// Re-orders matches for display and returns the id sets the UI needs to
// render badges. Does NOT touch score/tier/rankScore -- those stay exactly
// what the matching engine computed. This only changes render order.
export function applyDiscoveryOrder(
  matches: ScholarshipMatch[],
  userId: string,
  trendingIds: Set<string>
): { ordered: ScholarshipMatch[]; openIds: Set<string>; trendingIds: Set<string> } {
  const dayKey = new Date().toISOString().slice(0, 10);
  const rand = mulberry32(seedFrom(userId, dayKey));

  const openIds = new Set(matches.filter((m) => isCurrentlyOpen(m)).map((m) => m.id));

  const ordered: ScholarshipMatch[] = [];
  for (const tier of TIER_ORDER) {
    const group = matches.filter((m) => m.tier === tier);
    const pinned = group.filter((m) => openIds.has(m.id) && trendingIds.has(m.id));
    const rest = shuffle(
      group.filter((m) => !(openIds.has(m.id) && trendingIds.has(m.id))),
      rand
    );
    ordered.push(...pinned, ...rest);
  }

  return { ordered, openIds, trendingIds };
}
