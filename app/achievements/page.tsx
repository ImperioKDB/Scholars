import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { levelForXp } from "@/lib/xp/level";
import { AchievementsClient } from "./AchievementsClient";

// app/achievements/page.tsx
// GET /achievements
//
// Server component: fetches achievements + unlock state, hands everything
// to AchievementsClient for filtering/animation. Every achievement is
// still fetched and shown -- locked ones keep their full description
// visible, not a "???" mystery box (see AchievementsClient for the
// reasoning this preserves from the original version of this file).

type Achievement = {
  id: string;
  label: string;
  description: string;
  xp_reward: number;
  tier: "bronze" | "silver" | "gold";
};

type UnlockedRow = { achievement_id: string; unlocked_at: string };

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

  const achievementList = (achievements ?? []) as Achievement[];
  const unlockedList = (unlocked ?? []) as UnlockedRow[];
  const xpTotal = profile?.xp_total ?? 0;
  const { level, currentFloor, nextCeiling } = levelForXp(xpTotal);

  return (
    <AchievementsClient
      achievements={achievementList}
      unlocked={unlockedList}
      xpTotal={xpTotal}
      level={level}
      currentFloor={currentFloor}
      nextCeiling={nextCeiling}
    />
  );
}
