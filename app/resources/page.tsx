import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, SeoJsonLd } from "@/components/SeoJsonLd";
import { Footer } from "@/components/Footer";
import { OpportunityBridge, ResourceAdSlot, ResourceCard, ResourceEmptyState, ResourceErrorState, ResourcePageFrame } from "@/components/resource-center";
import { ResourceSearch } from "@/components/resource-center-search";
import { getResourceHomeWithRepositoryContent } from "@/lib/resource-center";
import {
  LOCAL_RESOURCE_CATEGORIES,
  getLocalResourceArticlesForCategory,
  getLocalResourceArticle,
  getLocalResourceCategoriesForArticle,
} from "@/lib/resource-content";
import type { SearchableArticle } from "@/components/resource-center-search";

export const metadata: Metadata = {
  title: "Resource Center for students",
  description: "Practical guides and trustworthy updates to help students in Nigeria find and pursue better opportunities.",
  alternates: { canonical: "https://www.scholars.com.ng/resources" },
  openGraph: { title: "Resource Center for students | Scholars", description: "Practical guides and trustworthy updates for students in Nigeria.", url: "https://www.scholars.com.ng/resources", type: "website" },
};

export default async function ResourcesPage() {
  let content;
  try {
    content = await getResourceHomeWithRepositoryContent();
  } catch {
    return <ResourcePageFrame><main className="mx-auto max-w-6xl px-6 py-16"><ResourceErrorState /></main><Footer /></ResourcePageFrame>;
  }

  const { articles, categories } = content;
  const visibleCategories = categories.filter((category) => {
    const localArticles = getLocalResourceArticlesForCategory(category.slug);
    return localArticles.length > 0;
  });
  const featured = articles[0];
  const latest = featured ? articles.slice(1) : articles;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Scholars Resource Center",
    description: metadata.description,
    url: `${base}/resources`,
    isPartOf: { "@type": "WebSite", name: "Scholars", url: base },
  };

  return (
    <ResourcePageFrame>
      <SeoJsonLd data={jsonLd} />
      <main>
        <section className="border-b border-hairline bg-white">
          <div className="mx-auto max-w-6xl px-6 pb-14 pt-8 md:pb-20 md:pt-12">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Resources" }]} />
            <div className="mt-10 grid gap-8 md:grid-cols-[1fr_280px] md:items-end">
              <div className="max-w-3xl">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald">The Scholars resource desk</p>
                <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] text-navy sm:text-6xl">Useful guidance for the next opportunity.</h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-navy-light sm:text-lg">Practical guides on scholarships, applications, academic development, skills, student life, and educational systems to help students in Nigeria move with confidence.</p>
              </div>
              <div className="border-l-2 border-emerald pl-5 text-sm leading-6 text-navy-light">
                <p className="font-display text-xl font-semibold text-navy">Read with purpose.</p>
                <p className="mt-2">No noise, no borrowed advice — just useful context for making your next move.</p>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-navy-light">Search the desk for a practical starting point.</p>
              <ResourceSearch
                articles={articles.map((article) => {
                  const localArticle = getLocalResourceArticle(article.slug);
                  const content = localArticle?.content_markdown ?? "";
                  const categoryLinks = localArticle
                    ? getLocalResourceCategoriesForArticle(localArticle.id)
                    : [];
                  const categoryNames = categoryLinks.map((c) => c.name);
                  return { ...article, content_markdown: content, categoryNames } as SearchableArticle;
                })}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald">Browse by subject</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-navy">Find the thread you need.</h2>
            </div>
            {visibleCategories.length > 0 && <span className="text-sm text-navy-light">{visibleCategories.length} active {visibleCategories.length === 1 ? "subject" : "subjects"}</span>}
          </div>
          {visibleCategories.length > 0 && <div className="mt-5 flex flex-wrap gap-2" aria-label="Resource categories">{visibleCategories.map((category) => <Link key={category.id} href={`/resources/category/${category.slug}`} className="rounded-seal border border-hairline bg-white px-4 py-2.5 text-sm font-medium text-navy-light transition-colors hover:border-navy hover:text-navy">{category.name}</Link>)}</div>}
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-12 md:pb-16">
          {articles.length === 0 ? <ResourceEmptyState /> : <>
            {featured && <div><div className="mb-4 flex items-center justify-between gap-4"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald">Start here</p><span className="text-xs text-navy-light">Newest published guide</span></div><ResourceCard article={featured} featured /></div>}
            {latest.length > 0 && <div className="mt-14"><div className="mb-5"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald">From the desk</p><h2 className="mt-2 font-display text-3xl font-semibold text-navy">Latest guidance</h2></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{latest.map((article) => <ResourceCard key={article.id} article={article} />)}</div></div>}
            <div className="mt-14"><OpportunityBridge /></div>
            <ResourceAdSlot placement="home" />
          </>}
        </section>
      </main>
      <Footer />
    </ResourcePageFrame>
  );
}
