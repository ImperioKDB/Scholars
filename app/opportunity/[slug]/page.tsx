import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { isClosedListing } from "@/lib/dates";
import { Breadcrumbs, SeoJsonLd } from "@/components/SeoJsonLd";
import { buildInternalReturnPath, buildOpportunityAuthPaths } from "@/lib/auth/return-destination";

// app/opportunity/[slug]/page.tsx
// GET /o/[id] -- public, unauthenticated share landing page for a single
// verified OPPORTUNITY (fellowship, internship, competition, mentorship).
// Mirrors app/s/[id]/page.tsx, the scholarship equivalent, with one honest
// difference: opportunities are discovery-only in v1 -- no rules, no match
// score -- so the panel below talks about tracking and applying, never
// eligibility scoring.
//
// This route is request-dynamic because authenticated visitors are routed to
// the existing protected full-detail page; public data is read only through
// the narrow view. Avoid caching a user-dependent redirect or stale content.
//
// Anonymous previews intentionally omit free-text descriptions, eligibility,
// application URLs, and instructions; those fields are not safe to infer.
//
// The ?ref=<sharer_profile_id> query param (added by ShareButton.tsx) is
// captured into a cookie by middleware.ts before this component ever
// renders -- this file doesn't need to read or forward it.
const PUBLIC_COLUMNS =
  "id, slug, type, title, provider_name, duration, location, compensation, deadline, verified";

type PublicOpportunity = {
  id: string;
  slug: string;
  type: "fellowship" | "internship" | "competition" | "mentorship" | "training";
  title: string;
  provider_name: string;
  duration: string | null;
  location: string | null;
  compensation: string | null;
  deadline: string | null;
  verified: boolean;
};

const TYPE_LABELS: Record<PublicOpportunity["type"], string> = {
  fellowship: "Fellowship",
  internship: "Internship",
  competition: "Competition",
  mentorship: "Mentorship",
  training: "Training",
};

const TYPE_TONES: Record<PublicOpportunity["type"], string> = {
  fellowship: "bg-navy-50 text-navy",
  internship: "bg-emerald-light text-emerald",
  competition: "bg-amber-light text-amber",
  mentorship: "bg-rose-light text-rose",
  training: "bg-navy-50 text-navy",
};

const loadOpportunity = cache(async (slug: string): Promise<PublicOpportunity | null> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("opportunities_public_preview_v1")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("verified", true)
    .maybeSingle();
  return data as PublicOpportunity | null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const opportunity = await loadOpportunity(slug);
  if (!opportunity) {
    return { title: "Opportunity not found -- Scholars" };
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const closed = isClosedListing(opportunity);
  const description = `A ${TYPE_LABELS[opportunity.type].toLowerCase()} opportunity on Scholars. Sign in to view eligibility and application information.`;
  return {
    title: opportunity.title,
    description,
    alternates: { canonical: `/opportunity/${slug}` },
    openGraph: {
      title: opportunity.title,
      description,
      siteName: "Scholars",
      locale: "en_NG",
      images: [
        {
          url: `${base}/opportunity/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${opportunity.title} -- opportunity on Scholars`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: opportunity.title,
      description,
      images: [`${base}/opportunity/${slug}/opengraph-image`],
    },
  };
}

export const dynamic = "force-dynamic";

function formatDeadline(deadline: string): string {
  const date = new Date(deadline + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function PublicOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (user) {
    const { data: authenticatedOpportunity } = await sessionClient
      .from("opportunities")
      .select("id")
      .eq("slug", slug)
      .eq("verified", true)
      .maybeSingle();
    if (authenticatedOpportunity?.id) {
      redirect(buildInternalReturnPath(`/opportunities/${authenticatedOpportunity.id}`, query));
    }
  }
  const opportunity = await loadOpportunity(slug);
  if (!opportunity) {
    notFound();
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const publicUrl = `${base}/opportunity/${slug}`;
  const closed = isClosedListing(opportunity);
  const returnTo = buildInternalReturnPath(`/opportunity/${opportunity.slug || slug}`, query);
  const { signupPath, loginPath } = buildOpportunityAuthPaths(returnTo);
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Logo className="text-navy" />
        </div>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Opportunities for students", href: "/opportunities-for-students" }, { name: opportunity.title }]} />
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
          {closed && (
            <div className="mb-5 rounded-xl border border-amber/30 bg-amber-light px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Applications closed</p>
              <p className="mt-1">This page is kept for historical reference. It is not an active application opportunity.</p>
            </div>
          )}
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
          </div>
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold text-navy mb-2">About this opportunity</h2>
            <p className="text-sm text-ink leading-relaxed">
              This {TYPE_LABELS[opportunity.type].toLowerCase()} is listed on Scholars. Create an account to review its eligibility requirements and application information.
            </p>
            {opportunity.duration && <p className="mt-2 text-sm text-navy-light"><span className="font-medium text-navy">Duration:</span> {opportunity.duration}</p>}
            {opportunity.location && <p className="mt-1 text-sm text-navy-light"><span className="font-medium text-navy">Location:</span> {opportunity.location}</p>}
          </div>
          <div className="flex items-start gap-3 bg-navy-50 rounded-xl p-4 mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-navy-light shrink-0 mt-0.5" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <p className="text-sm text-navy-light leading-relaxed">
              <span className="font-medium text-navy">{closed ? "This opportunity is closed." : "Opportunities like this aren&apos;t scored on Scholars."}</span>{" "}
              {closed ? "Create a free account to keep it in your history." : "Create a free account to save it, track your application, and get reminded before it closes."}
            </p>
          </div>
          <Link
            href={signupPath}
            className="block text-center rounded-seal bg-navy text-white text-sm font-medium px-6 py-3.5 hover:bg-navy-light transition-colors"
          >
            {closed ? "Save this opportunity -- join free" : "Track this opportunity -- join free"}
          </Link>
          <p className="text-sm text-navy-light mt-4 text-center">
            Already have an account?{" "}
            <Link href={loginPath} className="text-navy font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
        <SeoJsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: opportunity.title,
            description: `A ${TYPE_LABELS[opportunity.type].toLowerCase()} opportunity on Scholars. Sign in to view eligibility and application information.`,
            url: publicUrl,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
                { "@type": "ListItem", position: 2, name: "Opportunity", item: `${base}/opportunities-for-students` },
                { "@type": "ListItem", position: 3, name: opportunity.title, item: publicUrl },
              ],
            },
          }}
        />
      </div>
    </div>
  );
}
