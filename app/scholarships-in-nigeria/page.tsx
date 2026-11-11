import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { todayUtcIso } from "@/lib/dates";
import { pageHref, pageStart, parsePublicPage, PUBLIC_PAGE_SIZE } from "@/lib/public-pagination";

const PATH = "/scholarships-in-nigeria";
const TITLE = "Undergraduate Scholarships in Nigeria";
const DESCRIPTION =
  "Browse verified undergraduate scholarships in Nigeria, including deadlines, providers, awards, and study disciplines.";

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

type Scholarship = {
  id: string;
  slug: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string | null;
  discipline: string | null;
};

function formatDeadline(value: string | null) {
  if (!value) return "Rolling";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function ScholarshipsInNigeriaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePublicPage((await searchParams).page);
  const supabase = createPublicClient();
  const { data, count } = await supabase
    .from("scholarships_public_preview_v1")
    .select("id, slug, title, provider_name, amount, deadline, last_cycle_closed_at, discipline", { count: "exact" })
    .eq("verified", true)
    .in("level", ["undergrad", "both"])
    .or(`deadline.is.null,deadline.gte.${todayUtcIso()}`)
    .or(`last_cycle_closed_at.is.null,last_cycle_closed_at.gt.${todayUtcIso()}`)
    .order("deadline", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true })
    .range(pageStart(page), pageStart(page) + PUBLIC_PAGE_SIZE - 1);
  const scholarships = (data ?? []) as Scholarship[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PUBLIC_PAGE_SIZE));
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";

  return (
    <main className="min-h-screen bg-parchment px-4 py-10 md:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-medium text-navy hover:underline">Scholars</Link>
        <div className="mt-10 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-3">Verified opportunities</p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-navy">Undergraduate scholarships in Nigeria</h1>
          <p className="mt-5 text-base leading-7 text-navy-light">
            Find scholarships for students in Nigeria with clear deadlines, provider information, and study-discipline details. Scholars checks listings before publishing them and helps you compare opportunities against your profile.
          </p>
        </div>
        <section className="mt-10" aria-labelledby="scholarship-list-heading">
          <div className="flex items-end justify-between gap-4 mb-4">
            <h2 id="scholarship-list-heading" className="font-display text-2xl font-semibold text-navy">Current verified scholarships</h2>
            <span className="text-sm text-navy-light">Page {page} of {totalPages}</span>
          </div>
          {scholarships.length === 0 ? (
            <div className="rounded-2xl border border-hairline bg-white p-6 text-sm text-navy-light">No more current verified scholarships are available on this page.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {scholarships.map((scholarship) => (
                <article key={scholarship.id} className="rounded-2xl border border-hairline bg-white p-5 shadow-card">
                  <p className="text-xs font-medium text-navy-light">{scholarship.provider_name}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-navy">
                    <Link href={`/scholarship/${scholarship.slug}`} className="hover:underline">{scholarship.title}</Link>
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {scholarship.amount && <span className="rounded-full bg-emerald-light px-2.5 py-1 font-mono text-emerald">{scholarship.amount}</span>}
                    <span className="rounded-full bg-rose-light px-2.5 py-1 text-rose">Deadline {formatDeadline(scholarship.deadline)}</span>
                    {scholarship.discipline && <span className="rounded-full bg-navy-50 px-2.5 py-1 text-navy-light">{scholarship.discipline}</span>}
                  </div>
                  <Link href={`/scholarship/${scholarship.slug}`} className="mt-5 inline-block text-sm font-medium text-navy underline">View scholarship details</Link>
                </article>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <nav aria-label="Scholarship pages" className="mt-8 flex items-center justify-between gap-4 text-sm">
              {page > 1 ? <Link href={pageHref(PATH, page - 1)} className="font-medium text-navy underline">Previous</Link> : <span />}
              {page < totalPages ? <Link href={pageHref(PATH, page + 1)} className="font-medium text-navy underline">Next</Link> : <span />}
            </nav>
          )}
        </section>
        <section className="mt-12 max-w-2xl border-t border-hairline pt-8">
          <h2 className="font-display text-2xl font-semibold text-navy">How Scholars helps</h2>
          <p className="mt-3 text-sm leading-6 text-navy-light">Create one free profile to compare your course, institution, location, academic results, and other eligibility details with the requirements attached to each verified listing.</p>
          <Link href="/signup" className="mt-5 inline-block rounded-seal bg-navy px-5 py-3 text-sm font-medium text-white hover:bg-navy-light">Create your free profile</Link>
        </section>
        <SeoJsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: TITLE, url: `${base}${page === 1 ? PATH : `${PATH}?page=${page}`}`, mainEntity: { "@type": "ItemList", numberOfItems: scholarships.length, itemListElement: scholarships.map((item, index) => ({ "@type": "ListItem", position: pageStart(page) + index + 1, name: item.title, url: `${base}/scholarship/${item.slug}` })) } }} />
      </div>
    </main>
  );
}
