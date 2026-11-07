import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs, SeoJsonLd } from "@/components/SeoJsonLd";
import { ResourceArticleBody } from "@/components/ResourceArticleBody";

type Props = { params: { slug: string } };
type Article = { id: string; slug: string; title: string; excerpt: string | null; content_markdown: string; article_type: string; canonical_url: string | null; featured_image_path: string | null; reading_time_minutes: number | null; published_at: string; last_reviewed_at: string | null; author_name: string; author_bio: string | null; author_avatar_path: string | null };
type Category = { slug: string; name: string };

async function getArticle(slug: string) {
  const supabase = createClient();
  const { data: article } = await supabase.from("resource_public_articles").select("id,slug,title,excerpt,content_markdown,article_type,canonical_url,featured_image_path,reading_time_minutes,published_at,last_reviewed_at,author_name,author_bio,author_avatar_path").eq("slug", slug).maybeSingle();
  if (!article) return { article: null, categories: [] as Category[] };
  const { data: categoryLinks } = await supabase.from("resource_public_article_categories").select("slug,name").eq("article_id", article.id).limit(20);
  return { article: article as Article, categories: (categoryLinks ?? []) as Category[] };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { article } = await getArticle(params.slug);
  if (!article) return { title: "Resource not found" };
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const canonical = article.canonical_url ?? `${base}/resources/${article.slug}`;
  return { title: article.title, description: article.excerpt ?? undefined, alternates: { canonical }, openGraph: { type: "article", title: article.title, description: article.excerpt ?? undefined, url: canonical, publishedTime: article.published_at } };
}
export default async function ResourceArticlePage({ params }: Props) {
  const { article, categories } = await getArticle(params.slug);
  if (!article) notFound();
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const canonical = article.canonical_url ?? `${base}/resources/${article.slug}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.excerpt ?? undefined, mainEntityOfPage: canonical, datePublished: article.published_at, dateModified: article.last_reviewed_at ?? article.published_at, author: { "@type": "Person", name: article.author_name }, publisher: { "@type": "Organization", name: "Scholars", url: base } };
  return (
    <main className="min-h-screen bg-parchment">
      <SeoJsonLd data={jsonLd} />
      <article>
        <header className="border-b border-hairline bg-white">
          <div className="mx-auto max-w-4xl px-6 pb-12 pt-8 md:pb-16 md:pt-12">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Resources", href: "/resources" }, { name: article.title }]} />
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald"><span>{article.article_type}</span>{article.reading_time_minutes ? <span className="text-navy-light">{article.reading_time_minutes} min read</span> : null}</div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] text-navy sm:text-6xl">{article.title}</h1>
            {article.excerpt && <p className="mt-5 max-w-3xl text-lg leading-8 text-navy-light">{article.excerpt}</p>}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-navy-light"><span>By <strong className="font-semibold text-navy">{article.author_name}</strong></span><time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}</time></div>
          </div>
        </header>
        <div className="mx-auto grid max-w-4xl gap-10 px-6 py-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div><ResourceArticleBody content={article.content_markdown} /></div>
          <aside className="h-fit rounded-2xl border border-hairline bg-white p-5 lg:sticky lg:top-6"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-light">About the writer</p><p className="mt-3 font-display text-xl font-semibold text-navy">{article.author_name}</p>{article.author_bio && <p className="mt-2 text-sm leading-6 text-navy-light">{article.author_bio}</p>}{categories.length > 0 && <div className="mt-6 border-t border-hairline pt-5"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-light">Topics</p><div className="mt-3 flex flex-wrap gap-2">{categories.slice(0, 6).map((category) => <span key={category.slug} className="rounded-seal bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy">{category.name}</span>)}</div></div>}</aside>
        </div>
      </article>
    </main>
  );
}
