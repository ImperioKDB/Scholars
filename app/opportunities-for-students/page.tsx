import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { SeoJsonLd } from "@/components/SeoJsonLd";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Student Fellowships, Internships and Opportunities",
  description:
    "Find verified fellowships, internships, competitions, and mentorship opportunities for students in Nigeria and beyond.",
  alternates: { canonical: "/opportunities-for-students" },
};

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

export default async function OpportunitiesForStudentsPage() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("opportunities")
    .select("id, slug, type, title, provider_name, compensation, deadline, location")
    .eq("verified", true)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(50);
  const opportunities = (data ?? []) as Opportunity[];
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";

  return (
    <main className="min-h-screen bg-parchment px-4 py-10 md:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-medium text-navy hover:underline">Scholars</Link>
        <div className="mt-10 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-3">Verified opportunities</p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-navy">Student fellowships, internships and opportunities</h1>
          <p className="mt-5 text-base leading-7 text-navy-light">
            Explore verified opportunities for students, including fellowships, internships, competitions, and mentorship programmes. Check the provider, deadline, location, and compensation before you apply.
          </p>
        </div>
        <section className="mt-10" aria-labelledby="opportunity-list-heading">
          <div className="flex items-end justify-between gap-4 mb-4">
            <h2 id="opportunity-list-heading" className="font-display text-2xl font-semibold text-navy">Current verified opportunities</h2>
            <span className="text-sm text-navy-light">{opportunities.length} listing{opportunities.length === 1 ? "" : "s"}</span>
          </div>
          {opportunities.length === 0 ? (
            <div className="rounded-2xl border border-hairline bg-white p-6 text-sm text-navy-light">New verified opportunities are being researched. Please check back soon.</div>
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
        </section>
        <SeoJsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Student fellowships, internships and opportunities", url: `${base}/opportunities-for-students`, mainEntity: { "@type": "ItemList", numberOfItems: opportunities.length, itemListElement: opportunities.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title, url: `${base}/opportunity/${item.slug}` })) } }} />
      </div>
    </main>
  );
}
