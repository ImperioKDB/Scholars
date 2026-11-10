import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { formatVerifiedOn, isClosedListing } from "@/lib/dates";
import { Breadcrumbs, SeoJsonLd } from "@/components/SeoJsonLd";
import { isUuid } from "@/lib/validate";
import { buildInternalReturnPath, buildOpportunityAuthPaths } from "@/lib/auth/return-destination";
// app/scholarship/[slug]/page.tsx
// GET /s/[id] -- public, unauthenticated share landing page for a single
// verified scholarship. Deliberately outside app/scholarships/** (which
// sits behind middleware.ts's PROTECTED_PREFIXES) and outside that
// route's layout -- there is no Sidebar/AdeProvider shell here, this page
// stands alone.
//
// Authenticated visitors are routed to the existing protected detail page;
// keep the page request-dynamic so that redirect is never cached for others.
export const dynamic = "force-dynamic";
// Public preview selects only basic summary information. Free-text descriptions,
// eligibility details, application instructions and URLs are not safe fields.
//
// The ?ref=<sharer_profile_id> query param (added by ShareButton.tsx) is
// captured into a cookie by middleware.ts before this component ever
// renders -- this file doesn't need to read or forward it.
const PUBLIC_COLUMNS =
  "id, slug, title, provider_name, amount, deadline, last_cycle_closed_at, verified, last_verified_at";
type PublicScholarship = {
  id: string;
  slug: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  last_cycle_closed_at: string | null;
  verified: boolean;
  last_verified_at: string | null;
};
const loadScholarship = cache(async (slug: string): Promise<PublicScholarship | null> => {
  const supabase = createPublicClient();
  const { data: slugData } = await supabase
    .from("scholarships_public_preview_v1")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("verified", true)
    .maybeSingle();
  if (slugData) return slugData as PublicScholarship;
  if (!isUuid(slug)) return null;
  const { data: idData } = await supabase
    .from("scholarships_public_preview_v1")
    .select(PUBLIC_COLUMNS)
    .eq("id", slug)
    .eq("verified", true)
    .maybeSingle();
  return idData as PublicScholarship | null;
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scholarship = await loadScholarship(slug);
  if (!scholarship) {
    return { title: "Scholarship not found -- Scholars" };
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const title = scholarship.title;
  const closed = isClosedListing(scholarship);
  const description = `A scholarship listing on Scholars. Sign in to review eligibility and application information.`;
  const canonicalSlug = scholarship.slug || slug;
  const image = `${base}/scholarship/${canonicalSlug}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: `/scholarship/${canonicalSlug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/scholarship/${canonicalSlug}`,
      siteName: "Scholars",
      locale: "en_NG",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${title} -- scholarship opportunity on Scholars`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
function formatDeadline(deadline: string): string {
  const date = new Date(deadline + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export default async function PublicScholarshipPage({
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
    const baseQuery = sessionClient
      .from("scholarships")
      .select("id")
      .eq("verified", true);
    const { data: authenticatedScholarship } = isUuid(slug)
      ? await baseQuery.eq("id", slug).maybeSingle()
      : await baseQuery.eq("slug", slug).maybeSingle();
    if (authenticatedScholarship?.id) {
      redirect(buildInternalReturnPath(`/scholarships/${authenticatedScholarship.id}`, query));
    }
  }
  const scholarship = await loadScholarship(slug);
  if (!scholarship) {
    notFound();
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const publicUrl = `${base}/scholarship/${scholarship.slug || slug}`;
  const closed = isClosedListing(scholarship);
  const returnTo = buildInternalReturnPath(`/scholarship/${scholarship.slug || slug}`, query);
  const { signupPath, loginPath } = buildOpportunityAuthPaths(returnTo);
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Logo className="text-navy" />
        </div>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Scholarships in Nigeria", href: "/scholarships-in-nigeria" }, { name: scholarship.title }]} />
        <div className="bg-white rounded-2xl border border-hairline shadow-card p-6">
          <p className="text-xs font-medium text-navy-light mb-1">{scholarship.provider_name}</p>
          <h1 className="font-display text-2xl font-semibold text-navy leading-snug mb-4">
            {scholarship.title}
          </h1>
          {closed && (
            <div className="mb-5 rounded-xl border border-amber/30 bg-amber-light px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Applications closed</p>
              <p className="mt-1">This page is kept for historical reference. It is not an active application opportunity.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {scholarship.amount && (
              <span className="text-xs font-mono font-medium text-emerald bg-emerald-light px-2.5 py-1 rounded-full">
                {scholarship.amount}
              </span>
            )}
            {scholarship.deadline && (
              <span className="text-xs font-medium text-rose bg-rose-light px-2.5 py-1 rounded-full">
                Deadline {formatDeadline(scholarship.deadline)}
              </span>
            )}
          </div>
          {/* Push C trust line: a dated claim beats a timeless badge. For
              rows verified before migration 0021 we say who verified, not
              when, rather than inventing a date. */}
          <p className="text-xs text-navy-light mb-4">
            {scholarship.last_verified_at
              ? `Last checked by the Scholars team on ${formatVerifiedOn(scholarship.last_verified_at)}.`
              : "Verified by the Scholars team."}
          </p>
          <div className="rounded-xl border border-hairline p-4 mb-5">
            <h2 className="font-display text-lg font-semibold text-navy mb-2">About this scholarship</h2>
            <p className="text-sm text-navy-light leading-relaxed">
              This scholarship is listed on Scholars. Create a free account to review the full eligibility requirements and application information.
            </p>
          </div>
          <div className="flex items-start gap-3 bg-navy-50 rounded-xl p-4 mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-navy-light shrink-0 mt-0.5" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <p className="text-sm text-navy-light leading-relaxed">
              <span className="font-medium text-navy">Full details are available to signed-in users.</span>{" "}
              Sign in or register to continue to this scholarship after onboarding.
            </p>
          </div>
          <Link
            href={signupPath}
            className="block text-center rounded-seal bg-navy text-white text-sm font-medium px-6 py-3.5 hover:bg-navy-light transition-colors"
          >
            See if you qualify -- join free
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
            name: scholarship.title,
            description: "A scholarship listing on Scholars. Sign in to review eligibility and application information.",
            url: publicUrl,
            dateModified: scholarship.last_verified_at ?? undefined,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
                { "@type": "ListItem", position: 2, name: "Scholarship", item: `${base}/scholarships-in-nigeria` },
                { "@type": "ListItem", position: 3, name: scholarship.title, item: publicUrl },
              ],
            },
          }}
        />
      </div>
    </div>
  );
}
