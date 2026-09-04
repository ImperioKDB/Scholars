import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { getMatchesForCurrentUser } from "@/lib/matching/getMatches";
import { computeProfileGaps } from "@/lib/matching/gaps";
import { createClient } from "@/lib/supabase/server";
import { applyDiscoveryOrder, isCurrentlyOpen } from "@/lib/discovery";
import { DashboardClient } from "./DashboardClient";
import type { CardScholarship } from "@/components/ScholarshipCard";

type SavedApiItem = {
  id: string;
  saved_at: string;
  scholarship: CardScholarship;
};

export default async function DashboardPage() {
  const { user, profile } = await getCurrentUserAndProfile();

  if (!user) {
    return null;
  }

  const supabase = createClient();

  const [{ matches, profileCompleteness, error: matchError }, savedResult, trendingResult] = await Promise.all([
    getMatchesForCurrentUser(),
    supabase
      .from("saved_scholarships")
      .select(
        // scholarships!inner -- a saved scholarship that has since been
        // unverified by an admin fails the scholarships_select_verified
        // RLS policy on the join. Without !inner, PostgREST still returns
        // the saved_scholarships row with scholarship: null instead of
        // dropping it, and isCurrentlyOpen(s.scholarship) below crashes
        // the whole page reading .deadline off null. !inner drops the
        // row entirely instead, matching the pattern already used in
        // app/api/cron/deadline-check/route.ts.
        `id, saved_at,
         scholarship:scholarships!inner ( id, title, provider_name, description, amount, deadline, opens_at, application_url, level, discipline, verified )`
      )
      .eq("profile_id", user.id)
      .order("saved_at", { ascending: false }),
    // Real save-velocity signal, computed in Postgres -- see migration:
    // add_opens_at_and_trending_fn. Not a fabricated number: if fewer than
    // `threshold` students saved it in the last `days` days, it's not
    // trending, full stop.
    supabase.rpc("get_trending_scholarship_ids", { threshold: 3, days: 7 }),
  ]);

  const saved = (savedResult.data ?? []) as unknown as SavedApiItem[];
  const trendingIds = new Set(
    ((trendingResult.data ?? []) as { scholarship_id: string }[]).map((r) => r.scholarship_id)
  );

  // Reorders matches within each tier (open+trending pinned first, the
  // rest deterministically shuffled per user per day) instead of a fixed
  // score-sorted list -- see lib/discovery.ts for the reasoning. Tier
  // grouping itself is untouched, so "your best matches surface first"
  // still holds at the tier level; gaps below is computed from the
  // original unordered `matches`, since tier/status is all it reads.
  const { ordered, openIds } = applyDiscoveryOrder(matches, user.id, trendingIds);
  const matchesWithBadges = ordered.map((m) => ({
    ...m,
    isOpenNow: openIds.has(m.id),
    isTrending: trendingIds.has(m.id),
  }));

  const savedWithBadges = saved.map((s) => ({
    ...s,
    scholarship: {
      ...s.scholarship,
      isOpenNow: isCurrentlyOpen(s.scholarship),
      isTrending: trendingIds.has(s.scholarship.id),
    },
  }));

  const gaps = computeProfileGaps(matches);

  const loadError =
    matchError && matchError !== "profile_not_found"
      ? "Couldn't load your matches. Try refreshing."
      : null;

  return (
    <DashboardClient
      userId={user.id}
      fullName={profile?.full_name ?? null}
      initialMatches={matchesWithBadges}
      initialProfileCompleteness={profileCompleteness}
      initialSaved={savedWithBadges}
      initialError={loadError}
      gaps={gaps}
    />
  );
}
