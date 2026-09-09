import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createPublicClient } from "@/lib/supabase/public";

// app/o/[id]/page.tsx
// GET /o/[id] -- public, unauthenticated share landing page for a single
// verified OPPORTUNITY (fellowship, internship, competition, mentorship).
// Mirrors app/s/[id]/page.tsx, the scholarship equivalent, with one honest
// difference: opportunities are discovery-only in v1 -- no rules, no match
// score -- so the panel below talks about tracking and applying, never
// eligibility scoring.
//
// PERF (batch 1 pattern): ISR. Share pages are the growth channel and
// change rarely (verification flips). A 5-minute revalidation window keeps
// WhatsApp previews fast and off the database. This route is eligible for
// ISR because it reads through the cookie-free public client only
// (opportunities_select_verified RLS grants the public role read access to
// verified rows). Admin edits revalidate this path explicitly -- see
// app/api/admin/opportunities/** (revalidatePath).
//
// Shows only facts every visitor can honestly see: type, title, provider,
// compensation, deadline, description. NEVER a match score -- opportunities
// aren't scored (see app/api/opportunities/route.ts), and showing one here
// for an anonymous visitor would mean fabricating a number.
//
// The ?ref=<sharer_profile_id> query param (added by ShareButton.tsx) is
// captured into a cookie by middleware.ts before this component ever
// renders -- this file doesn't need to read or forward it.
const PUBLIC_COLUMNS =
  "id, type, title, provider_name, description, duration, location, compensation, discipline, deadline, application_url, how_to_apply, verified";

type PublicOpportunity = {
  id: string;
  type: "fellowship" | "internship" | "competition" | "mentorship";
  title: string;
  provider_name: string;
  description: string | null;
  duration: string | null;
  location: string | null;
  compensation: string | null;
  discipline: string | null;
  deadline: string | null;
  application_url: string | null;
  how_to_apply: string | null;
  verified: boolean;
};

const TYPE_LABELS: Record<PublicOpportunity["type"], string> = {
  fellowship: "Fellowship",
  internship: "Internship",
  competition: "Competition",
  mentorship: "Mentorship",
};

const TYPE_TONES: Record<PublicOpportunity["type"], string> = {
  fellowship: "bg-navy-50 text-navy",
  internship: "bg-emerald-light text-emerald",
  competition: "bg-amber-light text-amber",
  mentorship: "bg-rose-light text-rose",
};

async function loadOpportunity(id: string): Promise<PublicOpportunity | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("opportunities")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .eq("verified", true)
    .maybeSingle();
  return data as PublicOpportunity | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await loadOpportunity(id);
  if (!opportunity) {
    return { title: "Opportunity not found -- Scholars" };
  }
  return {
    title: opportunity.title + " -- Scholars",
    description:
      opportunity.provider_name +
      (opportunity.compensation ? " \u00b7 " + opportunity.compensation : "") +
      (opportunity.deadline ? " \u00b7 Deadline " + opportunity.deadline : " \u00b7 Rolling") +
      ". Find it on Scholars.",
  };
}

export const revalidate = 300;

function formatDeadline(deadline: string): string {
  const date = new Date(deadline + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function PublicOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await loadOpportunity(id);
  if (!opportunity) {
    notFound();
  }
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Logo className="text-navy" />
        </div>
        <div className="bg-white rounded-2xl border border-hairline shadow-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_TONES[opportunity.type]}`}>
              {TYPE_LABELS[opportunity.type]}
            </span>
            <span className="text-xs text-navy-light">{opportunity.provider_name}</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-navy leading-snug mb-4">
            {opportunity.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {opportunity.compensation && (
              <span className="text-xs font-mono font-medium text-emerald bg-emerald-light px-2.5 py-1 rounded-full">
                {opportunity.compensation}
              </span>
            )}
            {opportunity.deadline ? (
              <span className="text-xs font-medium text-rose bg-rose-light px-2.5 py-1 rounded-full">
                Deadline {formatDeadline(opportunity.deadline)}
              </span>
            ) : (
              <span className="text-xs font-medium bg-navy-50 text-navy-light px-2.5 py-1 rounded-full">
                Rolling / no deadline
              </span>
            )}
            {opportunity.location && <span className="text-xs text-navy-light">{opportunity.location}</span>}
            {opportunity.discipline && <span className="text-xs text-navy-light">\u00b7 {opportunity.discipline}</span>}
          </div>
          {opportunity.description && (
            <p className="text-sm text-ink leading-relaxed mb-5">{opportunity.description}</p>
          )}
          <div className="flex items-start gap-3 bg-navy-50 rounded-xl p-4 mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-navy-light shrink-0 mt-0.5" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <p className="text-sm text-navy-light leading-relaxed">
              <span className="font-medium text-navy">Opportunities like this aren&apos;t scored on Scholars.</span>{" "}
              Create a free account to save it, track your application, and get reminded before it closes.
            </p>
          </div>
          <Link
            href="/signup?next=/onboarding"
            className="block text-center rounded-seal bg-navy text-white text-sm font-medium px-6 py-3.5 hover:bg-navy-light transition-colors"
          >
            Track this opportunity -- join free
          </Link>
          <p className="text-sm text-navy-light mt-4 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-navy font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
