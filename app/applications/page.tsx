import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { ApplicationsClient } from "./ApplicationsClient";
import type { CardScholarship } from "@/components/ScholarshipCard";

type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected";

type ApplicationApiItem = {
  id: string;
  status: ApplicationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  draft_statement: string | null;
  draft_summary: {
    facts: { label: string; value: string }[];
    checklist: { item: string; have: boolean }[];
  } | null;
  draft_generated_at: string | null;
  draft_confirmed_at: string | null;
  scholarship: CardScholarship;
};

type SavedApiItem = {
  id: string;
  saved_at: string;
  scholarship: CardScholarship;
};

// how_to_apply added: fallback guidance shown when application_url is
// null (see migration: add_how_to_apply_fallback), so the "Open
// application" link in ApplicationsClient has something to fall back to
// instead of just disappearing.
const SCHOLARSHIP_COLUMNS =
  "id, title, provider_name, description, amount, deadline, application_url, how_to_apply, level, discipline, verified";

// scholarships!inner -- an application or saved-scholarship row whose
// joined scholarship has since failed RLS (e.g. an admin unverified it)
// must not come back as { scholarship: null }. ApplicationsClient reads
// a.scholarship.title / a.scholarship.application_url unconditionally,
// so !inner drops the unjoinable row entirely instead of crashing the
// render. Same fix applied to app/dashboard/page.tsx,
// app/api/applications/route.ts, and app/api/applications/[id]/route.ts.
const APPLICATION_COLUMNS = `id, status, notes, created_at, updated_at, draft_statement, draft_summary, draft_generated_at, draft_confirmed_at, scholarship:scholarships!inner ( ${SCHOLARSHIP_COLUMNS} )`;

// Server Component: fetches tracked applications and saved scholarships
// in parallel and hands them to ApplicationsClient as initial props.
// Previously this was a "use client" page that only started fetching
// after hydration. app/applications/loading.tsx now renders as the real
// Suspense fallback for exactly as long as this fetch takes.
export default async function ApplicationsPage() {
  const { user } = await getCurrentUserAndProfile();

  // middleware.ts already gates everything under /applications to
  // authenticated users; this is a defensive fallback.
  if (!user) {
    return null;
  }

  const supabase = createClient();

  const [appsResult, savedResult] = await Promise.all([
    supabase
      .from("applications")
      .select(APPLICATION_COLUMNS)
      .eq("profile_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("saved_scholarships")
      .select(`id, saved_at, scholarship:scholarships!inner ( ${SCHOLARSHIP_COLUMNS} )`)
      .eq("profile_id", user.id)
      .order("saved_at", { ascending: false }),
  ]);

  const applications = (appsResult.data ?? []) as unknown as ApplicationApiItem[];
  const saved = (savedResult.data ?? []) as unknown as SavedApiItem[];
  const loadError = appsResult.error ? "Couldn't load your applications. Try refreshing." : null;

  return (
    <ApplicationsClient
      initialApplications={applications}
      initialSaved={saved}
      initialError={loadError}
    />
  );
}
