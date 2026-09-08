import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { OpportunitiesClient } from "./OpportunitiesClient";
import type { CardOpportunity } from "@/components/OpportunityCard";

type SavedApiItem = {
  id: string;
  saved_at: string;
  opportunity: CardOpportunity;
};

const OPPORTUNITY_COLUMNS =
  "id, type, title, provider_name, description, duration, location, compensation, discipline, deadline, opens_at, application_url, how_to_apply, verified";

// Server Component: fetches saved opportunities up front and hands them to
// OpportunitiesClient as initial props, same pattern as
// app/discover/page.tsx and app/applications/page.tsx. The catalog itself
// loads client-side (search/filter needs to be interactive), but saved
// state is available on first paint.
export default async function OpportunitiesPage() {
  const { user } = await getCurrentUserAndProfile();
  // middleware.ts gates /opportunities to authenticated users; this is a
  // defensive fallback.
  if (!user) {
    return null;
  }

  const supabase = createClient();
  const savedResult = await supabase
    .from("saved_opportunities")
    .select(`id, saved_at, opportunity:opportunities!inner ( ${OPPORTUNITY_COLUMNS} )`)
    .eq("profile_id", user.id)
    .order("saved_at", { ascending: false });

  const saved = (savedResult.data ?? []) as unknown as SavedApiItem[];

  return <OpportunitiesClient initialSaved={saved} />;
}
