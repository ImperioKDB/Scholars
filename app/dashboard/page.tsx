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

export default async function DashboardPage() {
  const { user, profile } = await getCurrentUserAndProfile();

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

  const loadError =
    matchError && matchError !== "profile_not_found"
      ? "Couldn't load your matches. Try refreshing."
      : null;

  return (
    <DashboardClient
      userId={user.id}
      fullName={profile?.full_name ?? null}
      initialMatches={matches}
      initialProfileCompleteness={profileCompleteness}
      initialSaved={saved}
      initialError={loadError}
      gaps={gaps}
    />
  );
}
