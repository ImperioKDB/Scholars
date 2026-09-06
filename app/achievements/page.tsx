import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { levelForXp } from "@/lib/xp/level";
import { AchievementsClient, type ProgressCounts } from "./AchievementsClient";

// app/achievements/page.tsx
// GET /achievements
//
// Server component: fetches achievements + unlock state + the real counts
// that drive locked-card progress (achievements upgrade #2), hands
// everything to AchievementsClient. Progress is computed from real rows
// (saved / applications / submissions / referrals / completeness) -- never
// invented. The referral count reads xp_events, which needs migration
// 0011 (xp_events_select_own); if that policy isn't live yet the read
// errors and we degrade referralCount to 0 rather than failing the page.
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
  const [
    { data: achievements },
    { data: unlocked },
    { count: referralCount, error: referralError },
    { count: savedCount },
    { count: appCount },
    { count: subCount },
  ] = await Promise.all([
    supabase
      .from("achievements")
      .select("id, label, description, xp_reward, tier")
      .order("xp_reward", { ascending: true }),
    supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("profile_id", user.id),
    supabase
      .from("xp_events")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("event_type", "referral_confirmed"),
    supabase.from("saved_scholarships").select("id", { count: "exact", head: true }).eq("profile_id", user.id),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("profile_id", user.id),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("status", "submitted"),
  ]);

  const achievementList = (achievements ?? []) as Achievement[];
  const unlockedList = (unlocked ?? []) as UnlockedRow[];
  const xpTotal = profile?.xp_total ?? 0;
  const { level, currentFloor, nextCeiling } = levelForXp(xpTotal);

  const progress: ProgressCounts = {
    completeness: profile?.profile_completeness ?? 0,
    savedCount: savedCount ?? 0,
    appCount: appCount ?? 0,
    subCount: subCount ?? 0,
    // xp_events needs migration 0011 (select-own). Degrade to 0, not an error.
    referralCount: referralError ? 0 : referralCount ?? 0,
  };

  return (
    <AchievementsClient
      achievements={achievementList}
      unlocked={unlockedList}
      xpTotal={xpTotal}
      level={level}
      currentFloor={currentFloor}
      nextCeiling={nextCeiling}
      progress={progress}
    />
  );
}
