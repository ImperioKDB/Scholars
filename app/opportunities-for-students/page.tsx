import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { todayUtcIso } from "@/lib/dates";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { pageHref, pageStart, parsePublicPage, PUBLIC_PAGE_SIZE } from "@/lib/public-pagination";

const PATH = "/opportunities-for-students";
const TITLE = "Student Fellowships, Internships and Opportunities";
const DESCRIPTION =
  "Find verified fellowships, internships, competitions, mentorship, and training opportunities for students in Nigeria and beyond.";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const page = parsePublicPage((await searchParams).page);
  return {
    title: page === 1 ? TITLE : `${TITLE} — Page ${page}`,
    description: DESCRIPTION,
    alternates: { canonical: page === 1 ? PATH : `${PATH}?page=${page}` },
    robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: page === 1 ? TITLE : `${TITLE} — Page ${page}`,
      description: DESCRIPTION,
      url: page === 1 ? PATH : `${PATH}?page=${page}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: page === 1 ? TITLE : `${TITLE} — Page ${page}`,
      description: DESCRIPTION,
    },
  };
}

type Opportunity = {
  id: string;
  slug: string;
  type: string;
  title: string;
  provider_name: string;
  compensation: string | null;
  deadline: string | null;
  location: string | null;
};

function formatDeadline(value: string | null) {
  if (!value) return "Rolling";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function OpportunitiesForStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePublicPage((await searchParams).page);
  const supabase = createPublicClient();
  const { data, count } = await supabase
    .from("opportunities_public_preview_v1")
    .select("id, slug, type, title, provider_name, compensation, deadline, location", { count: "exact" })
    .eq("verified", true)
    .or(`deadline.is.null,deadline.gte.${todayUtcIso()}`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(pageStart(page), pageStart(page) + PUBLIC_PAGE_SIZE - 1);
  const opportunities = (data ?? []) as Opportunity[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PUBLIC_PAGE_SIZE));
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";

  return (
    <main className="min-h-screen bg-parchment px-4 py-10 md:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-medium text-navy hover:underline">Scholars</Link>
        <div className="mt-10 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-3">Verified opportunities</p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-navy">Student fellowships, internships and opportunities</h1>
          <p className="mt-5 text-base leading-7 text-navy-light">
            Explore verified opportunities for students, including fellowships, internships, competitions, mentorship, and training programmes. Check the provider, deadline, location, and compensation before you apply.
          </p>
        </div>
        <section className="mt-10" aria-labelledby="opportunity-list-heading">
          <div className="flex items-end justify-between gap-4 mb-4">
            <h2 id="opportunity-list-heading" className="font-display text-2xl font-semibold text-navy">Current verified opportunities</h2>
            <span className="text-sm text-navy-light">Page {page} of {totalPages}</span>
          </div>
          {opportunities.length === 0 ? (
            <div className="rounded-2xl border border-hairline bg-white p-6 text-sm text-navy-light">No more current verified opportunities are available on this page.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {opportunities.map((opportunity) => (
                <article key={opportunity.id} className="rounded-2xl border border-hairline bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between gap-3 text-xs text-navy-light">
                    <span className="font-medium uppercase tracking-wide">{opportunity.type}</span>
                    {opportunity.location && <span>{opportunity.location}</span>}
                  </div>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-navy">
                    <Link href={`/opportunity/${opportunity.slug}`} className="hover:underline">{opportunity.title}</Link>
                  </h3>
                  <p className="mt-1 text-sm text-navy-light">{opportunity.provider_name}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {opportunity.compensation && <span className="rounded-full bg-emerald-light px-2.5 py-1 font-mono text-emerald">{opportunity.compensation}</span>}
                    <span className="rounded-full bg-rose-light px-2.5 py-1 text-rose">Deadline {formatDeadline(opportunity.deadline)}</span>
                  </div>
                  <Link href={`/opportunity/${opportunity.slug}`} className="mt-5 inline-block text-sm font-medium text-navy underline">View opportunity details</Link>
                </article>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <nav aria-label="Opportunity pages" className="mt-8 flex items-center justify-between gap-4 text-sm">
              {page > 1 ? <Link href={pageHref(PATH, page - 1)} className="font-medium text-navy underline">Previous</Link> : <span />}
              {page < totalPages ? <Link href={pageHref(PATH, page + 1)} className="font-medium text-navy underline">Next</Link> : <span />}
            </nav>
          )}
        </section>
        <SeoJsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: TITLE, url: `${base}${page === 1 ? PATH : `${PATH}?page=${page}`}`, mainEntity: { "@type": "ItemList", numberOfItems: opportunities.length, itemListElement: opportunities.map((item, index) => ({ "@type": "ListItem", position: pageStart(page) + index + 1, name: item.title, url: `${base}/opportunity/${item.slug}` })) } }} />
      </div>
    </main>
  );
}
