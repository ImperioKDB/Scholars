import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { DiscoverClient } from "./DiscoverClient";

// app/discover/page.tsx
// GET /discover
//
// Student-facing browse/search across every verified scholarship --
// closes the audit's "no search or filtering for students" finding. The
// dashboard stays the personalized ranked view; this page is the
// unranked catalog with keyword + level + discipline filters, backed by
// GET /api/scholarships (extended with the `q` param in batch 4).
//
// /discover was already in middleware.ts's PROTECTED_PREFIXES and its
// matcher, so no middleware change was needed to ship this route.
export default async function DiscoverPage() {
  const { user } = await getCurrentUserAndProfile();
  // middleware.ts already gates /discover to authenticated users; this
  // is a defensive fallback.
  if (!user) {
    return null;
  }

  const supabase = createClient();
  const { data: savedRows } = await supabase
    .from("saved_scholarships")
    .select("scholarship_id")
    .eq("profile_id", user.id);

  return (
    <DiscoverClient
      userId={user.id}
      initialSavedIds={(savedRows ?? []).map((r) => r.scholarship_id as string)}
    />
  );
}
