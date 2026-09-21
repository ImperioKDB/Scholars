import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { getMatchesForCurrentUser } from "@/lib/matching/getMatches";
import { createClient } from "@/lib/supabase/server";
import { FreshMatchesClient } from "./FreshMatchesClient";

export const dynamic = "force-dynamic";

export default async function FreshMatchesPage() {
  const { user } = await getCurrentUserAndProfile();
  if (!user) return null;

  const [{ matches, error }, savedResult] = await Promise.all([
    getMatchesForCurrentUser(),
    createClient()
      .from("saved_scholarships")
      .select("scholarship_id")
      .eq("profile_id", user.id),
  ]);

  return (
    <FreshMatchesClient
      initialMatches={matches}
      initialSavedIds={(savedResult.data ?? []).map((row) => row.scholarship_id)}
      initialError={error && error !== "profile_not_found" ? "Couldn’t load your fresh matches. Try refreshing." : null}
    />
  );
}
