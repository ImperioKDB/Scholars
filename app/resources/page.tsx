import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/SeoJsonLd";

export const metadata: Metadata = {
  title: "Resources for students",
  description: "Practical guides and trustworthy updates to help students in Nigeria find and pursue better opportunities.",
  alternates: { canonical: "/resources" },
};

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  article_type: string;
  published_at: string;
  reading_time_minutes: number | null;
  author_name: string;
};
type Category = { id: string; slug: string; name: string; description: string | null };

export default async function ResourcesPage() {
  const supabase = createClient();
  const [{ data: articles }, { data: categories }] = await Promise.all([
    supabase
      .from("resource_public_articles")
      .select("id,slug,title,excerpt,article_type,published_at,reading_time_minutes,author_name")
      .order("published_at", { ascending: false })
      .limit(50),
    supabase
      .from("resource_public_categories")
      .select("id,slug,name,description")
      .order("display_order", { ascending: true })
      .limit(30),
  ]);
  const rows = (articles ?? []) as Article[];
  const categoryRows = (categories ?? []) as Category[];
  return (
    <main className="min-h-screen bg-parchment">
      <section className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-6 pb-14 pt-8 md:pb-20 md:pt-12">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Resources" }]} />
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald">The Scholars resource desk</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] text-navy sm:text-6xl">Useful guidance for the next opportunity.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-navy-light sm:text-lg">Clear, practical articles about scholarships, applications, deadlines and the decisions that help students in Nigeria move with confidence.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        {categoryRows.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2" aria-label="Resource categories">
            {categoryRows.map((category) => (
              <Link key={category.id} href={`/resources/category/${category.slug}`} className="rounded-seal border border-hairline bg-white px-4 py-2 text-sm font-medium text-navy-light transition-colors hover:border-navy hover:text-navy">
                {category.name}
              </Link>
            ))}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-8 md:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber">Coming soon</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-navy">The first guides are being prepared.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-navy-light">The Resource Center is ready for reviewed, published content. Check back soon for practical guidance from the Scholars team.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((article) => (
              <article key={article.id} className="flex h-full flex-col rounded-2xl border border-hairline bg-white p-6 shadow-card transition-transform hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald">
                  <span>{article.article_type}</span>
                  {article.reading_time_minutes ? <span className="text-navy-light">{article.reading_time_minutes} min read</span> : null}
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold leading-tight text-navy"><Link href={`/resources/${article.slug}`} className="hover:underline">{article.title}</Link></h2>
                {article.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-6 text-navy-light">{article.excerpt}</p>}
                <div className="mt-auto flex items-center justify-between gap-3 pt-7 text-xs text-navy-light">
                  <span>By {article.author_name}</span>
                  <Link href={`/resources/${article.slug}`} className="font-semibold text-navy hover:underline">Read guide →</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
