import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, SeoJsonLd } from "@/components/SeoJsonLd";
import { Footer } from "@/components/Footer";
import { ResourceArticleBody, extractArticleHeadings } from "@/components/ResourceArticleBody";
import { ArticleTableOfContents, ReadingProgress, ShareArticle } from "@/components/resource-center-interactions";
import { ResourceAdSlot, ResourceCard, ResourceImage, ResourcePageFrame } from "@/components/resource-center";
import { getResourceArticleWithRepositoryContent, getResourceCanonicalUrl, getResourceImageUrl, ResourceDataError } from "@/lib/resource-center";
import Link from "next/link";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const result = await getResourceArticleWithRepositoryContent(params.slug);
    if (!result) return { title: "Resource not found" };
    const { article } = result;
    const canonical = getResourceCanonicalUrl(article.slug, article.canonical_url);
    return { title: article.title, description: article.excerpt ?? undefined, alternates: { canonical }, openGraph: { type: "article", title: article.title, description: article.excerpt ?? undefined, url: canonical, publishedTime: article.published_at, modifiedTime: article.last_reviewed_at ?? article.published_at }, twitter: { card: "summary_large_image", title: article.title, description: article.excerpt ?? undefined } };
  } catch {
    return { title: "Resource not found" };
  }
}

export default async function ResourceArticlePage({ params }: Props) {
  let result;
  try {
    result = await getResourceArticleWithRepositoryContent(params.slug);
  } catch (error) {
    if (error instanceof ResourceDataError) return <ResourcePageFrame><main className="mx-auto max-w-6xl px-6 py-16"><div role="alert" className="rounded-2xl border border-rose/30 bg-white p-8 md:p-12"><p className="font-mono text-xs uppercase tracking-[0.16em] text-rose">A quiet moment</p><h1 className="mt-3 font-display text-3xl font-semibold text-navy">We could not load this guide.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-navy-light">Please try again shortly, or return to the Resource Center.</p><Link href="/resources" className="mt-6 inline-flex rounded-seal bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Back to resources</Link></div></main><Footer /></ResourcePageFrame>;
    throw error;
  }
  if (!result) notFound();

  const { article, categories, related } = result;
  const canonical = getResourceCanonicalUrl(article.slug, article.canonical_url);
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const headings = extractArticleHeadings(article.content_markdown);
  const imageUrl = getResourceImageUrl(article.featured_image_path);
  const breadcrumbItems = [{ name: "Home", href: "/" }, { name: "Resources", href: "/resources" }, ...(categories[0] ? [{ name: categories[0].name, href: `/resources/category/${categories[0].slug}` }] : []), { name: article.title }];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: article.title, description: article.excerpt ?? undefined, mainEntityOfPage: canonical, datePublished: article.published_at, dateModified: article.last_reviewed_at ?? article.published_at, ...(imageUrl ? { image: [imageUrl] } : {}), author: { "@type": "Person", name: article.author_name || "Scholars" }, publisher: { "@type": "Organization", name: "Scholars", url: base } },
      { "@type": "BreadcrumbList", itemListElement: breadcrumbItems.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, ...(item.href ? { item: `${base}${item.href}` } : {}) })) },
    ],
  };
  const formatDate = (value: string) => new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });

  return (
    <ResourcePageFrame>
      <ReadingProgress />
      <SeoJsonLd data={jsonLd} />
      <main>
        <article>
          <header className="border-b border-hairline bg-white">
            <div className="mx-auto max-w-5xl px-6 pb-12 pt-8 md:pb-16 md:pt-12">
              <Breadcrumbs items={breadcrumbItems} />
              <div className="mt-10 max-w-4xl"><div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald"><span>{article.article_type}</span>{article.reading_time_minutes ? <span className="text-navy-light">{article.reading_time_minutes} min read</span> : null}</div><h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] text-navy sm:text-6xl">{article.title}</h1>{article.excerpt && <p className="mt-5 max-w-3xl text-lg leading-8 text-navy-light">{article.excerpt}</p>}<div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-navy-light"><span>By <strong className="font-semibold text-navy">{article.author_name || "Scholars"}</strong></span><time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}</time><ShareArticle title={article.title} /></div></div>
            </div>
          </header>
          <div className="mx-auto max-w-5xl px-6 pt-8 md:pt-12">{article.featured_image_path && <ResourceImage path={article.featured_image_path} alt={`${article.title} featured image`} priority className="aspect-[16/9] w-full rounded-2xl" />}</div>
          <ResourceAdSlot placement="in-article" />
          <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 md:py-16 lg:grid-cols-[minmax(0,680px)_220px] lg:items-start">
            <div className="min-w-0"><ResourceArticleBody content={article.content_markdown} /><div className="mt-8 border-t border-hairline pt-5 text-sm text-navy-light"><p>Published {formatDate(article.published_at)}.</p>{article.last_reviewed_at && <p>Last reviewed {formatDate(article.last_reviewed_at)}.</p>}</div></div>
            <aside className="space-y-5 lg:sticky lg:top-6"><ArticleTableOfContents headings={headings} /><div className="rounded-2xl border border-hairline bg-white p-5"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-light">About the writer</p><p className="mt-3 font-display text-xl font-semibold text-navy">{article.author_name || "Scholars"}</p>{article.author_bio && <p className="mt-2 text-sm leading-6 text-navy-light">{article.author_bio}</p>}{categories.length > 0 && <div className="mt-6 border-t border-hairline pt-5"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-light">Topics</p><div className="mt-3 flex flex-wrap gap-2">{categories.slice(0, 6).map((category) => <Link key={category.slug} href={`/resources/category/${category.slug}`} className="rounded-seal bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy hover:bg-emerald-light">{category.name}</Link>)}</div></div>}</div></aside>
          </div>
        </article>
        {related.length > 0 && <section className="border-t border-hairline bg-white"><div className="mx-auto max-w-5xl px-6 py-12 md:py-16"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald">Keep reading</p><h2 className="mt-2 font-display text-3xl font-semibold text-navy">More from the desk</h2><div className="mt-6 grid gap-5 md:grid-cols-3">{related.map((item) => <ResourceCard key={item.id} article={item} />)}</div></div></section>}
        <section className="mx-auto max-w-5xl px-6 py-12 md:py-16"><div className="rounded-2xl bg-navy px-6 py-8 text-white md:px-10"><p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-emerald-light">Your next move</p><h2 className="mt-3 font-display text-3xl font-semibold">Ready to find the opportunities that fit?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/70">Scholars helps students in Nigeria discover verified scholarships and opportunities matched to their profile.</p><Link href="/signup" className="mt-6 inline-flex rounded-seal bg-white px-5 py-3 text-sm font-semibold text-navy hover:bg-parchment">Build your free profile <span aria-hidden="true" className="ml-2">→</span></Link></div></section>
      </main>
      <Footer />
    </ResourcePageFrame>
  );
}
