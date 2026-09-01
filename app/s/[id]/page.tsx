import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createPublicClient } from "@/lib/supabase/public";

// app/s/[id]/page.tsx
// GET /s/[id] -- public, unauthenticated share landing page for a single
// verified scholarship. Deliberately outside app/scholarships/** (which
// sits behind middleware.ts's PROTECTED_PREFIXES) and outside that
// route's layout -- there is no Sidebar/AdeProvider shell here, this page
// stands alone.
//
// Shows only facts every visitor can honestly see: title, provider,
// amount, deadline, description. NEVER a match score or eligibility
// status -- those are computed against a signed-in student's profile
// (lib/matching/engine.ts), and showing one here for an anonymous visitor
// would mean fabricating a number. The panel below states plainly that
// eligibility gets checked, without pretending to already know the answer
// for this visitor.
//
// The ?ref=<sharer_profile_id> query param (added by ShareButton.tsx) is
// captured into a cookie by middleware.ts before this component ever
// renders -- this file doesn't need to read or forward it.

const PUBLIC_COLUMNS =
  "id, title, provider_name, description, amount, deadline, level, discipline, verified";

type PublicScholarship = {
  id: string;
  title: string;
  provider_name: string;
  description: string | null;
  amount: string | null;
  deadline: string;
  level: "undergrad" | "postgrad" | "both";
  discipline: string | null;
  verified: boolean;
};

async function loadScholarship(id: string): Promise<PublicScholarship | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("scholarships")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .eq("verified", true)
    .maybeSingle();

  return data as PublicScholarship | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scholarship = await loadScholarship(id);

  if (!scholarship) {
    return { title: "Scholarship not found -- Scholars" };
  }

  return {
    title: scholarship.title + " -- Scholars",
    description:
      scholarship.provider_name +
      (scholarship.amount ? " \u00b7 " + scholarship.amount : "") +
      " \u00b7 Deadline " +
      scholarship.deadline +
      ". See if you qualify on Scholars.",
  };
}

function formatDeadline(deadline: string): string {
  const date = new Date(deadline + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function PublicScholarshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scholarship = await loadScholarship(id);

  if (!scholarship) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Logo className="text-navy" />
        </div>

        <div className="bg-white rounded-2xl border border-hairline shadow-card p-6">
          <p className="text-xs font-medium text-navy-light mb-1">{scholarship.provider_name}</p>
          <h1 className="font-display text-2xl font-semibold text-navy leading-snug mb-4">
            {scholarship.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 mb-5">
            {scholarship.amount && (
              <span className="text-xs font-mono font-medium text-emerald bg-emerald-light px-2.5 py-1 rounded-full">
                {scholarship.amount}
              </span>
            )}
            <span className="text-xs font-medium text-rose bg-rose-light px-2.5 py-1 rounded-full">
              Deadline {formatDeadline(scholarship.deadline)}
            </span>
            <span className="text-xs text-navy-light px-1">
              {scholarship.level === "both" ? "Undergrad & postgrad" : scholarship.level}
              {scholarship.discipline ? " \u00b7 " + scholarship.discipline : ""}
            </span>
          </div>

          {scholarship.description && (
            <p className="text-sm text-ink leading-relaxed mb-5">{scholarship.description}</p>
          )}

          <div className="flex items-start gap-3 bg-navy-50 rounded-xl p-4 mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-navy-light shrink-0 mt-0.5" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <p className="text-sm text-navy-light leading-relaxed">
              <span className="font-medium text-navy">Your eligibility isn&apos;t shown yet.</span>{" "}
              Build a free profile and Scholars checks this scholarship&apos;s requirements against your
              GPA, state, discipline, and more -- automatically.
            </p>
          </div>

          <Link
            href="/signup?next=/onboarding"
            className="block text-center rounded-seal bg-navy text-white text-sm font-medium px-6 py-3.5 hover:bg-navy-light transition-colors"
          >
            See if you qualify -- join free
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
