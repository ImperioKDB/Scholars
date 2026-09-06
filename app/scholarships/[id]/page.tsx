import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchForScholarship } from "@/lib/matching/getMatches";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { ScholarshipDetailClient } from "./ScholarshipDetailClient";

type ApplicationStatus = "in_progress" | "submitted" | "accepted" | "rejected";

export default async function ScholarshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getCurrentUserAndProfile();
  if (!user) {
    return null;
  }
  const supabase = await createClient();
  // LATENCY FIX: getMatchForScholarship (2 queries) used to run first, then
  // saved + application ran as a second wave. All four queries are
  // independent, so run them in ONE parallel wave to cut a full Supabase
  // round-trip off every card click.
  const [matchResult, savedResult, applicationResult] = await Promise.all([
    getMatchForScholarship(id),
    supabase
      .from("saved_scholarships")
      .select("id")
      .eq("profile_id", user.id)
      .eq("scholarship_id", id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id, status")
      .eq("profile_id", user.id)
      .eq("scholarship_id", id)
      .maybeSingle(),
  ]);
  const { match, error } = matchResult;
  if (error === "not_found") {
    notFound();
  }
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
  const initialApplication =
    (applicationResult.data as { id: string; status: ApplicationStatus } | null) ?? null;
  return (
    <ScholarshipDetailClient
      scholarship={match}
      initialSaved={Boolean(savedResult.data)}
      initialApplication={initialApplication}
      sharerId={user.id}
    />
  );
}
