"use client";
import { useMemo, useState } from "react";
import { XpCounter } from "./XpCounter";
import { titleForLevel } from "@/lib/xp/level";

type Achievement = {
  id: string;
  label: string;
  description: string;
  xp_reward: number;
  tier: "bronze" | "silver" | "gold";
};
type UnlockedRow = { achievement_id: string; unlocked_at: string };
type Filter = "all" | "unlocked" | "locked";

export type ProgressCounts = {
  completeness: number;
  savedCount: number;
  appCount: number;
  subCount: number;
  referralCount: number;
};

const TIER_LABELS: Record<Achievement["tier"], string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

// Medals stay inside the app's locked brand palette (the same "gold reuses
// emerald" convention as the old tier chips) rather than inventing literal
// metal hues. Locked medals desaturate to the hairline/gray family.
const TIER_MEDAL: Record<Achievement["tier"], { ring: string; fill: string; text: string }> = {
  bronze: { ring: "#966216", fill: "#FBF1E1", text: "text-amber" },
  silver: { ring: "#14315C", fill: "#EEF2F8", text: "text-navy" },
  gold: { ring: "#15705A", fill: "#E4F3EE", text: "text-emerald" },
};

const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatUnlockedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ACHIEVEMENTS UPGRADE (#1): a medal object reusing the MatchSeal ring
// language. Unlocked = full-color ring + star glyph (+ the existing
// new-unlock shimmer when fresh). Locked = desaturated ring + lock glyph.
// Hand-rolled SVG to match the codebase's existing hand-rolled icon style
// (no icon library is installed in this project).
function Medal({
  tier,
  unlocked,
  isNew,
  size = 48,
}: {
  tier: Achievement["tier"];
  unlocked: boolean;
  isNew?: boolean;
  size?: number;
}) {
  const tone = TIER_MEDAL[tier];
  return (
    <div className={`relative shrink-0 rounded-full ${isNew ? "achievement-new" : ""}`}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <circle
          cx="24"
          cy="24"
          r="20"
          fill={unlocked ? tone.fill : "#F7F5EF"}
          stroke={unlocked ? tone.ring : "#E4E1D8"}
          strokeWidth="3"
        />
        <circle
          cx="24"
          cy="24"
          r="14.5"
          fill="none"
          stroke={unlocked ? tone.ring : "#E4E1D8"}
          strokeWidth="1.5"
          opacity="0.45"
        />
        {unlocked ? (
          <path
            d="M24 15l2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9z"
            fill={tone.ring}
          />
        ) : (
          <g stroke="#8B93A3" strokeWidth="2" fill="none" strokeLinecap="round">
            <rect x="18.5" y="22" width="11" height="8.5" rx="2" />
            <path d="M20.5 22v-2.5a3.5 3.5 0 0 1 7 0V22" />
          </g>
        )}
      </svg>
    </div>
  );
}

// ACHIEVEMENTS UPGRADE (#2): real progress toward each locked achievement,
// computed server-side from real rows. Returns null when we have no honest
// signal for that achievement, in which case the card shows no bar.
function progressFor(
  id: string,
  p: ProgressCounts
): { have: number; need: number; unit: string } | null {
  switch (id) {
    case "profile_complete":
      return { have: p.completeness, need: 100, unit: "%" };
    case "first_save":
      return { have: Math.min(p.savedCount, 1), need: 1, unit: "save" };
    case "first_application":
      return { have: Math.min(p.appCount, 1), need: 1, unit: "application" };
    case "first_submission":
      return { have: Math.min(p.subCount, 1), need: 1, unit: "submission" };
    case "scout":
      return { have: Math.min(p.referralCount, 1), need: 1, unit: "referral" };
    case "connector":
      return { have: Math.min(p.referralCount, 5), need: 5, unit: "referral" };
    case "mentor":
      return { have: Math.min(p.referralCount, 15), need: 15, unit: "referral" };
    default:
      return null;
  }
}

export function AchievementsClient({
  achievements,
  unlocked,
  xpTotal,
  level,
  currentFloor,
  nextCeiling,
  progress,
}: {
  achievements: Achievement[];
  unlocked: UnlockedRow[];
  xpTotal: number;
  level: number;
  currentFloor: number;
  nextCeiling: number | null;
  progress: ProgressCounts;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const unlockedMap = useMemo(
    () => new Map(unlocked.map((u) => [u.achievement_id, u.unlocked_at])),
    [unlocked]
  );
  const progressPct = nextCeiling
    ? Math.round(((xpTotal - currentFloor) / (nextCeiling - currentFloor)) * 100)
    : 100;
  const unlockedList = achievements.filter((a) => unlockedMap.has(a.id));
  const lockedList = achievements.filter((a) => !unlockedMap.has(a.id));

  const showUnlocked = filter !== "locked";
  const showLocked = filter !== "unlocked";

  const TABS: { value: Filter; label: string }[] = [
    { value: "all", label: `All (${achievements.length})` },
    { value: "unlocked", label: `Unlocked (${unlockedList.length})` },
    { value: "locked", label: `Locked (${lockedList.length})` },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Achievements</h1>
        <p className="text-sm text-navy-light mt-1 mb-6">
          Earned from using Scholars -- completing your profile, tracking applications, and helping
          other students find scholarships.
        </p>
        <div className="bg-white rounded-xl border border-hairline p-5">
          <div className="flex items-center justify-between mb-2">
            {/* ACHIEVEMENTS UPGRADE (#3): level title next to the number. */}
            <p className="text-sm font-medium text-ink">
              Level {level} &middot; {titleForLevel(level)}
            </p>
            <p className="text-xs font-mono text-navy-light">
              <XpCounter value={xpTotal} /> XP
            </p>
          </div>
          <div className="h-2 rounded-full bg-hairline overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-navy-light mt-2">
            {nextCeiling
              ? `${nextCeiling - xpTotal} XP to Level ${level + 1} \u00b7 ${titleForLevel(level + 1)}`
              : "Max level reached"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={
              "inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-medium transition-colors " +
              (filter === t.value ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {showUnlocked && unlockedList.length > 0 && (
        <div className="mb-8">
          {filter === "all" && (
            <h2 className="font-display text-lg font-semibold text-navy mb-3">Your shelf</h2>
          )}
          {/* ACHIEVEMENTS UPGRADE (#1): unlocked achievements live on a medal
              shelf, not a card list. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {unlockedList.map((a, i) => {
              const unlockedAt = unlockedMap.get(a.id)!;
              const isNew = Date.now() - new Date(unlockedAt).getTime() < NEW_WINDOW_MS;
              return (
                <div
                  key={a.id}
                  className="animate-card-in flex flex-col items-center text-center bg-white rounded-xl border border-hairline p-4"
                  style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                >
                  <Medal tier={a.tier} unlocked isNew={isNew} size={56} />
                  <p className="font-display font-semibold text-navy mt-2 text-sm leading-snug">{a.label}</p>
                  <p className="text-xs font-mono text-emerald mt-0.5">+{a.xp_reward} XP</p>
                  <p className="text-[10px] text-navy-light mt-0.5">{formatUnlockedDate(unlockedAt)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showUnlocked && unlockedList.length === 0 && (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center mb-8">
          <p className="text-sm text-navy-light">No unlocks yet. They&apos;ll appear on your shelf as you earn them.</p>
        </div>
      )}

      {showLocked && lockedList.length > 0 && (
        <div>
          {filter === "all" && (
            <h2 className="font-display text-lg font-semibold text-navy mb-3">Locked</h2>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {lockedList.map((a, i) => {
              const prog = progressFor(a.id, progress);
              return (
                <div
                  key={a.id}
                  className="animate-card-in bg-white rounded-xl border border-hairline p-5 flex gap-4"
                  style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                >
                  <Medal tier={a.tier} unlocked={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-display font-semibold text-navy-light">{a.label}</p>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-navy-50 text-navy-light shrink-0">
                        {TIER_LABELS[a.tier]}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed mb-3 text-navy-light">{a.description}</p>
                    {prog && (
                      <div className="mb-2">
                        <div className="h-1.5 rounded-full bg-hairline overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber"
                            style={{ width: `${Math.round((prog.have / prog.need) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-navy-light mt-1">
                          {prog.unit === "%"
                            ? `${prog.have}% of ${prog.need}%`
                            : `${prog.have} of ${prog.need} ${prog.need === 1 ? prog.unit : prog.unit + "s"}`}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-emerald">+{a.xp_reward} XP</span>
                      <span className="text-xs text-navy-light">Locked</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showLocked && lockedList.length === 0 && filter === "locked" && (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">Nothing locked -- you&apos;ve unlocked everything so far.</p>
        </div>
      )}
    </div>
  );
}
