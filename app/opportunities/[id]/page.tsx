import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { OpportunityDetailClient, type SimilarOpportunity } from "./OpportunityDetailClient";
import type { CardOpportunity } from "@/components/OpportunityCard";

// app/opportunities/[id]/page.tsx
// GET /opportunities/[id]
//
// Authenticated opportunity detail page, mirroring /scholarships/[id].
// Opportunities are discovery-only (no eligibility scoring), so this page
// shows facts every visitor can honestly see: type, title, provider,
// compensation, deadline, duration, location, description, eligibility
// notes. NEVER a match score -- opportunities are not scored.
//
// The public share page lives separately at /o/[id] (unauthenticated,
// same pattern as /s/[id] for scholarships).
const PUBLIC_COLUMNS =
  "id, type, title, provider_name, description, eligibility_notes, duration, location, compensation, discipline, deadline, application_url, how_to_apply, verified";

const SIMILAR_COLUMNS = "id, type, title, provider_name, compensation, deadline, discipline";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getCurrentUserAndProfile();
  if (!user) {
    return null;
  }
  const supabase = createClient();
  const [opportunityResult, savedResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select(PUBLIC_COLUMNS)
      .eq("id", id)
      .eq("verified", true)
      .maybeSingle(),
    supabase
      .from("saved_opportunities")
      .select("id")
      .eq("profile_id", user.id)
      .eq("opportunity_id", id)
      .maybeSingle(),
  ]);
  const opportunity = opportunityResult.data as CardOpportunity | null;
  if (!opportunity) {
    notFound();
  }
  // SIMILAR OPPORTUNITIES: same type first, fall back to same discipline,
  // so the detail page never ends as a dead end. Ordered by soonest
  // deadline so the rail surfaces the most time-relevant alternatives.
  let similar: SimilarOpportunity[] = [];
  const { data: sameType } = await supabase
    .from("opportunities")
    .select(SIMILAR_COLUMNS)
    .eq("verified", true)
    .eq("type", opportunity.type)
    .neq("id", id)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(3);
  similar = (sameType ?? []) as SimilarOpportunity[];
  if (similar.length === 0 && opportunity.discipline) {
    const { data: sameDiscipline } = await supabase
      .from("opportunities")
      .select(SIMILAR_COLUMNS)
      .eq("verified", true)
      .neq("id", id)
      .eq("discipline", opportunity.discipline)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(3);
    similar = (sameDiscipline ?? []) as SimilarOpportunity[];
  }
  return (
    <OpportunityDetailClient
      opportunity={opportunity}
      initialSaved={Boolean(savedResult.data)}
      sharerId={user.id}
      similar={similar}
    />
  );
}
