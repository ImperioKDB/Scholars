"use client";

import { useMemo, useState } from "react";
import { XpCounter } from "./XpCounter";

type Achievement = {
  id: string;
  label: string;
  description: string;
  xp_reward: number;
  tier: "bronze" | "silver" | "gold";
};

type UnlockedRow = { achievement_id: string; unlocked_at: string };

type Filter = "all" | "unlocked" | "locked";

// Deliberately stays inside the app's existing locked palette (navy /
// emerald / amber / rose) rather than inventing literal bronze/silver/
// gold hues -- gold reuses emerald, the tier this app already treats as
// top-tier elsewhere (MatchSeal's "Excellent fit").
const TIER_LABELS: Record<Achievement["tier"], string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

const TIER_CHIP_CLASSES: Record<Achievement["tier"], string> = {
  bronze: "bg-navy-50 text-navy-light",
  silver: "bg-navy-50 text-navy",
  gold: "bg-emerald-light text-emerald",
};

// Achievements unlocked within this window get the "New" shimmer + pill
// on the achievements page -- keeps a recent win visible without needing
// a separate feed. Deliberately short (a day, not a week) so the badge
// doesn't feel stale by the time someone notices it.
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatUnlockedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AchievementsClient({
  achievements,
  unlocked,
  xpTotal,
  level,
  currentFloor,
  nextCeiling,
}: {
  achievements: Achievement[];
  unlocked: UnlockedRow[];
  xpTotal: number;
  level: number;
  currentFloor: number;
  nextCeiling: number | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const unlockedMap = useMemo(
    () => new Map(unlocked.map((u) => [u.achievement_id, u.unlocked_at])),
    [unlocked]
  );

  const progressPct = nextCeiling
    ? Math.round(((xpTotal - currentFloor) / (nextCeiling - currentFloor)) * 100)
    : 100;

  const unlockedCount = achievements.filter((a) => unlockedMap.has(a.id)).length;
  const lockedCount = achievements.length - unlockedCount;

  const filtered = achievements.filter((a) => {
    if (filter === "unlocked") return unlockedMap.has(a.id);
    if (filter === "locked") return !unlockedMap.has(a.id);
    return true;
  });

  const TABS: { value: Filter; label: string }[] = [
    { value: "all", label: `All (${achievements.length})` },
    { value: "unlocked", label: `Unlocked (${unlockedCount})` },
    { value: "locked", label: `Locked (${lockedCount})` },
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
            <p className="text-sm font-medium text-ink">Level {level}</p>
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
            {nextCeiling ? `${nextCeiling - xpTotal} XP to Level ${level + 1}` : "Max level reached"}
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
              "text-sm font-medium px-3 py-1.5 rounded-full transition-colors " +
              (filter === t.value ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">Nothing in this filter yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((a, i) => {
            const unlockedAt = unlockedMap.get(a.id);
            const isUnlocked = Boolean(unlockedAt);
            const isNew = isUnlocked && Date.now() - new Date(unlockedAt!).getTime() < NEW_WINDOW_MS;

            return (
              <div
                key={a.id}
                className={[
                  "animate-card-in bg-white rounded-xl border border-hairline p-5",
                  isUnlocked ? "border-l-4 border-l-emerald" : "",
                  isNew ? "achievement-new" : "",
                ].join(" ")}
                // Cap the stagger delay -- past ~10 cards the eye has already
                // settled, so further delay just makes scrolling feel laggy.
                style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className={`font-display font-semibold ${isUnlocked ? "text-navy" : "text-navy-light"}`}>
                    {a.label}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isNew && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald text-white">
                        New
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${TIER_CHIP_CLASSES[a.tier]}`}>
                      {TIER_LABELS[a.tier]}
                    </span>
                  </div>
                </div>
                <p className={`text-sm leading-relaxed mb-3 ${isUnlocked ? "text-ink" : "text-navy-light"}`}>
                  {a.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-emerald">+{a.xp_reward} XP</span>
                  {isUnlocked ? (
                    <span className="text-xs text-navy-light">Unlocked {formatUnlockedDate(unlockedAt!)}</span>
                  ) : (
                    <span className="text-xs text-navy-light">Locked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
