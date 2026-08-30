import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { getMatchesForCurrentUser } from "@/lib/matching/getMatches";
import { computeProfileGaps } from "@/lib/matching/gaps";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import type { CardScholarship } from "@/components/ScholarshipCard";

type SavedApiItem = {
  id: string;
  saved_at: string;
  scholarship: CardScholarship;
};

// Server Component: fetches everything the dashboard needs in one request
// (profile via the deduped cache() helper, matches, and saved
// scholarships, run in parallel) and hands it to DashboardClient as
// initial props. Previously this was a "use client" page that fetched
// nothing until after hydration -- profile, matches, and saved
// scholarships each went out as separate client-side round trips on
// mount, with profile queried a second and third time along the way.
// app/dashboard/loading.tsx now renders as the real Suspense fallback
// for exactly as long as this fetch takes, rather than a client-only
// loading flag.
//
// Gap nudges (lib/matching/gaps.ts) are computed here, synchronously, from
// the same `matches` array getMatchesForCurrentUser() already returned --
// no extra query, just a pure aggregation over data already in memory.
export default async function DashboardPage() {
  const { user, profile } = await getCurrentUserAndProfile();

  // middleware.ts already gates everything under /dashboard to
  // authenticated users; this is a defensive fallback, not the primary
  // auth boundary.
  if (!user) {
    return null;
  }

  const supabase = createClient();

  const [{ matches, profileCompleteness, error: matchError }, savedResult] = await Promise.all([
    getMatchesForCurrentUser(),
    supabase
      .from("saved_scholarships")
      .select(
        `id, saved_at,
         scholarship:scholarships ( id, title, provider_name, description, amount, deadline, application_url, level, discipline, verified )`
      )
      .eq("profile_id", user.id)
      .order("saved_at", { ascending: false }),
  ]);

  const saved = (savedResult.data ?? []) as unknown as SavedApiItem[];
  const gaps = computeProfileGaps(matches);

  // profile_not_found is the normal state for a user who hasn't finished
  // onboarding -- not an error banner, just an empty-matches state.
  const loadError =
    matchError && matchError !== "profile_not_found"
      ? "Couldn't load your matches. Try refreshing."
      : null;

  return (
    <DashboardClient
      fullName={profile?.full_name ?? null}
      initialMatches={matches}
      initialProfileCompleteness={profileCompleteness}
      initialSaved={saved}
      initialError={loadError}
      gaps={gaps}
    />
  );
}
