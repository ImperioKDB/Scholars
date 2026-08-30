import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchForScholarship } from "@/lib/matching/getMatches";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { ScholarshipDetailClient } from "./ScholarshipDetailClient";

type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected";

type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  draft_statement: string | null;
  draft_summary: {
    facts: { label: string; value: string }[];
    checklist: { item: string; have: boolean }[];
  } | null;
  draft_generated_at: string | null;
  draft_confirmed_at: string | null;
};

// Server Component: evaluates the scholarship against the current user's
// profile server-side (same engine the dashboard uses, via
// getMatchForScholarship) and fetches saved/tracking status in parallel,
// then hands everything to ScholarshipDetailClient as initial props --
// same pattern as app/dashboard/page.tsx and app/applications/page.tsx.
//
// The applications query now also selects the auto-apply draft columns so
// the "Generate application draft" flow can live right on this page, next
// to Save/Track, instead of only on the Applications tab.
export default async function ScholarshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getCurrentUserAndProfile();

  // middleware.ts already gates /scholarships to authenticated users;
  // this is a defensive fallback, not the primary auth boundary.
  if (!user) {
    return null;
  }

  const { match, error } = await getMatchForScholarship(id);

  if (error === "not_found") {
    notFound();
  }

  // profile_not_found is the normal state for a user who hasn't finished
  // onboarding -- send them there instead of a dead error page.
  if (error === "profile_not_found") {
    return (
      <div className="bg-white rounded-2xl border border-hairline shadow-card p-8 text-center">
        <p className="text-sm text-navy-light mb-4">
          Complete your profile to see how well you match this scholarship.
        </p>
        <Link href="/onboarding" className="text-sm font-medium text-navy hover:underline">
          Finish your profile &rarr;
        </Link>
      </div>
    );
  }

  if (error || !match) {
    return <p className="text-sm text-rose">Couldn&apos;t load this scholarship. Try refreshing.</p>;
  }

  const supabase = await createClient();
  const [savedResult, applicationResult] = await Promise.all([
    supabase
      .from("saved_scholarships")
      .select("id")
      .eq("profile_id", user.id)
      .eq("scholarship_id", id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id, status, draft_statement, draft_summary, draft_generated_at, draft_confirmed_at")
      .eq("profile_id", user.id)
      .eq("scholarship_id", id)
      .maybeSingle(),
  ]);

  const initialApplication = (applicationResult.data as ApplicationRow | null) ?? null;

  return (
    <ScholarshipDetailClient
      scholarship={match}
      initialSaved={Boolean(savedResult.data)}
      initialApplication={initialApplication}
    />
  );
}
