// lib/xp/level.ts
// Simple growth curve for the level shown in the sidebar and on
// /achievements. Not tied to any single achievement -- xp_total already
// reflects everything (profile completeness, saves, applications,
// submissions, referrals, and achievement-unlock bonuses) via the
// Postgres ledger (xp_events + the sync_xp_total trigger). Each level
// costs progressively more: early levels come fast, matching how quickly
// a new student can complete onboarding; later ones need sustained real
// usage or successful referrals.

const LEVEL_THRESHOLDS = [0, 20, 50, 100, 175, 275, 400, 550, 725, 925, 1150];

export function levelForXp(xp: number): { level: number; currentFloor: number; nextCeiling: number | null } {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const currentFloor = LEVEL_THRESHOLDS[level - 1];
  const nextCeiling = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
  return { level, currentFloor, nextCeiling };
}
