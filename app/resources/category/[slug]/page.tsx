import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, SeoJsonLd } from "@/components/SeoJsonLd";
import { Footer } from "@/components/Footer";
import { OpportunityBridge, ResourceCard, ResourceEmptyState, ResourceErrorState, ResourcePageFrame } from "@/components/resource-center";
import { getResourceCategory, ResourceDataError } from "@/lib/resource-center";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const result = await getResourceCategory(params.slug);
    if (!result) return { title: "Resource category" };
    return { title: `${result.category.name} resources`, description: result.category.description ?? `Guides and updates in ${result.category.name}.`, alternates: { canonical: `/resources/category/${result.category.slug}` }, openGraph: { title: `${result.category.name} resources`, description: result.category.description ?? undefined, url: `/resources/category/${result.category.slug}`, type: "website" } };
  } catch {
    return { title: "Resource category" };
  }
}

export default async function ResourceCategoryPage({ params }: Props) {
  let result;
  try {
    result = await getResourceCategory(params.slug);
  } catch (error) {
    if (error instanceof ResourceDataError) return <ResourcePageFrame><main className="mx-auto max-w-6xl px-6 py-16"><ResourceErrorState /></main><Footer /></ResourcePageFrame>;
    throw error;
  }
  if (!result) notFound();
  const { category, articles } = result;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${category.name} resources`, description: category.description ?? undefined, url: `${base}/resources/category/${category.slug}` };
  const featured = articles[0];
  const remaining = articles.slice(1);

  return (
    <ResourcePageFrame>
      <SeoJsonLd data={jsonLd} />
      <main>
        <section className="border-b border-hairline bg-white">
          <div className="mx-auto max-w-6xl px-6 pb-12 pt-8 md:pt-12">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Resources", href: "/resources" }, { name: category.name }]} />
            <div className="mt-10 max-w-3xl"><p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald">Resource category</p><h1 className="mt-4 font-display text-4xl font-semibold text-navy sm:text-5xl">{category.name}</h1>{category.description && <p className="mt-4 text-base leading-7 text-navy-light">{category.description}</p>}<p className="mt-5 text-sm text-navy-light">{articles.length} eligible {articles.length === 1 ? "guide" : "guides"}</p></div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          {articles.length === 0 ? <ResourceEmptyState categoryName={category.name} /> : <>
            {featured && <div><p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald">Latest in {category.name}</p><ResourceCard article={featured} featured /></div>}
            {remaining.length > 0 && <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{remaining.map((article) => <ResourceCard key={article.id} article={article} />)}</div>}
            <div className="mt-14"><OpportunityBridge /></div>
          </>}
          <Link href="/resources" className="mt-10 inline-flex text-sm font-semibold text-navy hover:underline">← Back to all resources</Link>
        </section>
      </main>
      <Footer />
    </ResourcePageFrame>
  );
}
