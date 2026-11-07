import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/SeoJsonLd";

type Props = { params: { slug: string } };
type Category = { id: string; slug: string; name: string; description: string | null };
type Article = { id: string; slug: string; title: string; excerpt: string | null; article_type: string; published_at: string; reading_time_minutes: number | null; author_name: string };

async function getCategory(slug: string) {
  const supabase = createClient();
  const { data } = await supabase.from("resource_public_categories").select("id,slug,name,description").eq("slug", slug).maybeSingle();
  return data as Category | null;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory(params.slug);
  return category ? { title: `${category.name} resources`, description: category.description ?? `Guides and updates in ${category.name}.`, alternates: { canonical: `/resources/category/${category.slug}` } } : { title: "Resource category" };
}
export default async function ResourceCategoryPage({ params }: Props) {
  const supabase = createClient();
  const category = await getCategory(params.slug);
  if (!category) notFound();
  const { data: links } = await supabase.from("resource_public_article_categories").select("article_id").eq("slug", params.slug).limit(50);
  const ids = [...new Set((links ?? []).map((row) => row.article_id as string))];
  const { data: articles } = ids.length ? await supabase.from("resource_public_articles").select("id,slug,title,excerpt,article_type,published_at,reading_time_minutes,author_name").in("id", ids).order("published_at", { ascending: false }).limit(50) : { data: [] };
  const rows = (articles ?? []) as Article[];
  return (
    <main className="min-h-screen bg-parchment">
      <section className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-6 pb-12 pt-8 md:pt-12">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Resources", href: "/resources" }, { name: category.name }]} />
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald">Resource category</p>
          <h1 className="mt-4 font-display text-4xl font-semibold text-navy sm:text-5xl">{category.name}</h1>
          {category.description && <p className="mt-4 max-w-2xl text-base leading-7 text-navy-light">{category.description}</p>}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        {rows.length === 0 ? <p className="rounded-2xl border border-hairline bg-white p-8 text-sm text-navy-light">No published guides in this category yet.</p> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rows.map((article) => <article key={article.id} className="flex h-full flex-col rounded-2xl border border-hairline bg-white p-6 shadow-card"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald">{article.article_type}</p><h2 className="mt-4 font-display text-2xl font-semibold leading-tight text-navy"><Link href={`/resources/${article.slug}`} className="hover:underline">{article.title}</Link></h2>{article.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-6 text-navy-light">{article.excerpt}</p>}<div className="mt-auto pt-7 text-xs text-navy-light">By {article.author_name}</div></article>)}</div>}
      </section>
    </main>
  );
}
