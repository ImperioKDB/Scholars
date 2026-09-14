import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { SeoJsonLd } from "@/components/SeoJsonLd";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Undergraduate Scholarships in Nigeria",
  description:
    "Browse verified undergraduate scholarships in Nigeria, including deadlines, providers, awards, and study disciplines.",
  alternates: { canonical: "/scholarships-in-nigeria" },
};

type Scholarship = {
  id: string;
  title: string;
  provider_name: string;
  amount: string | null;
  deadline: string;
  discipline: string | null;
};

function formatDeadline(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function ScholarshipsInNigeriaPage() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("scholarships")
    .select("id, title, provider_name, amount, deadline, discipline")
    .eq("verified", true)
    .in("level", ["undergrad", "both"])
    .order("deadline", { ascending: true })
    .limit(50);
  const scholarships = (data ?? []) as Scholarship[];
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://scholars.com.ng";

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
            <span className="text-sm text-navy-light">{scholarships.length} listing{scholarships.length === 1 ? "" : "s"}</span>
          </div>
          {scholarships.length === 0 ? (
            <div className="rounded-2xl border border-hairline bg-white p-6 text-sm text-navy-light">New verified scholarships are being researched. Please check back soon.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {scholarships.map((scholarship) => (
                <article key={scholarship.id} className="rounded-2xl border border-hairline bg-white p-5 shadow-card">
                  <p className="text-xs font-medium text-navy-light">{scholarship.provider_name}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-navy">
                    <Link href={`/s/${scholarship.id}`} className="hover:underline">{scholarship.title}</Link>
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {scholarship.amount && <span className="rounded-full bg-emerald-light px-2.5 py-1 font-mono text-emerald">{scholarship.amount}</span>}
                    <span className="rounded-full bg-rose-light px-2.5 py-1 text-rose">Deadline {formatDeadline(scholarship.deadline)}</span>
                    {scholarship.discipline && <span className="rounded-full bg-navy-50 px-2.5 py-1 text-navy-light">{scholarship.discipline}</span>}
                  </div>
                  <Link href={`/s/${scholarship.id}`} className="mt-5 inline-block text-sm font-medium text-navy underline">View scholarship details</Link>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="mt-12 max-w-2xl border-t border-hairline pt-8">
          <h2 className="font-display text-2xl font-semibold text-navy">How Scholars helps</h2>
          <p className="mt-3 text-sm leading-6 text-navy-light">Create one free profile to compare your course, institution, location, academic results, and other eligibility details with the requirements attached to each verified listing.</p>
          <Link href="/signup" className="mt-5 inline-block rounded-seal bg-navy px-5 py-3 text-sm font-medium text-white hover:bg-navy-light">Create your free profile</Link>
        </section>
        <SeoJsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Undergraduate scholarships in Nigeria", url: `${base}/scholarships-in-nigeria`, mainEntity: { "@type": "ItemList", numberOfItems: scholarships.length, itemListElement: scholarships.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title, url: `${base}/s/${item.id}` })) } }} />
      </div>
    </main>
  );
}
