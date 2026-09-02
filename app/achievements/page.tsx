import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { levelForXp } from "@/lib/xp/level";

// app/achievements/page.tsx
// GET /achievements
//
// Every achievement is shown -- locked ones keep their full description
// visible, not a "???" mystery box. Same honesty call already made on the
// public share cards (no fabricated match scores): a mystery-box unlock
// is a manipulation technique, not information. Showing exactly what
// unlocks something is more useful and doesn't undercut trust in a
// platform students rely on for real financial decisions.

type Achievement = {
  id: string;
  label: string;
  description: string;
  xp_reward: number;
  tier: "bronze" | "silver" | "gold";
};

type UnlockedRow = { achievement_id: string; unlocked_at: string };

const TIER_LABELS: Record<Achievement["tier"], string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

// Deliberately stays inside the app's existing locked palette (navy /
// emerald / amber / rose) rather than inventing literal bronze/silver/
// gold hues -- gold reuses emerald, the color this app already uses
// elsewhere for its top tier (MatchSeal's "Excellent fit").
const TIER_CHIP_CLASSES: Record<Achievement["tier"], string> = {
  bronze: "bg-navy-50 text-navy-light",
  silver: "bg-navy-50 text-navy",
  gold: "bg-emerald-light text-emerald",
};

function formatUnlockedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AchievementsPage() {
  const { user, profile } = await getCurrentUserAndProfile();

  if (!user) {
    return null;
  }

  const supabase = createClient();

  const [{ data: achievements }, { data: unlocked }] = await Promise.all([
    supabase
      .from("achievements")
      .select("id, label, description, xp_reward, tier")
      .order("xp_reward", { ascending: true }),
    supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("profile_id", user.id),
  ]);

  const unlockedMap = new Map(((unlocked ?? []) as UnlockedRow[]).map((u) => [u.achievement_id, u.unlocked_at]));
  const xpTotal = profile?.xp_total ?? 0;
  const { level, currentFloor, nextCeiling } = levelForXp(xpTotal);
  const progressPct = nextCeiling
    ? Math.round(((xpTotal - currentFloor) / (nextCeiling - currentFloor)) * 100)
    : 100;

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
            <p className="text-xs font-mono text-navy-light">{xpTotal} XP</p>
          </div>
          <div className="h-2 rounded-full bg-hairline overflow-hidden">
            <div className="h-full rounded-full bg-emerald" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-navy-light mt-2">
            {nextCeiling ? `${nextCeiling - xpTotal} XP to Level ${level + 1}` : "Max level reached"}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(achievements ?? []).map((a) => {
          const unlockedAt = unlockedMap.get(a.id);
          const isUnlocked = Boolean(unlockedAt);
          return (
            <div
              key={a.id}
              className={[
                "bg-white rounded-xl border border-hairline p-5",
                isUnlocked ? "border-l-4 border-l-emerald" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className={`font-display font-semibold ${isUnlocked ? "text-navy" : "text-navy-light"}`}>
                  {a.label}
                </p>
                <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${TIER_CHIP_CLASSES[a.tier]}`}>
                  {TIER_LABELS[a.tier]}
                </span>
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
    </div>
  );
}
