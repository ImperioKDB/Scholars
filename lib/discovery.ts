import type { ScholarshipMatch } from "./matching/types";

export function isCurrentlyOpen(scholarship: {
  opens_at?: string | null;
  last_cycle_closed_at?: string | null;
  deadline: string | null;
}): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (scholarship.deadline && scholarship.deadline < today) return false;
  if (scholarship.opens_at) return scholarship.opens_at <= today;
  if (scholarship.last_cycle_closed_at) return false;
  return true;
}

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
