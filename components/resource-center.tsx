import Link from "next/link";
import { getResourceImageUrl, type ResourceArticleCard } from "@/lib/resource-center";
import { Logo } from "@/components/Logo";
import { ResourceMobileNav } from "@/components/resource-center-interactions";

export function ResourceMasthead() {
  return (
    <header className="border-b border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Logo className="text-navy" />
        <nav aria-label="Resource Center navigation" className="hidden items-center gap-6 text-sm font-medium text-navy-light md:flex">
          <Link href="/resources" className="transition-colors hover:text-navy">Resource desk</Link>
          <Link href="/scholarships-in-nigeria" className="transition-colors hover:text-navy">Find scholarships</Link>
          <Link href="/opportunities-for-students" className="transition-colors hover:text-navy">Opportunities</Link>
        </nav>
        <ResourceMobileNav />
        <Link href="/signup" className="rounded-seal bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light">
          Build your profile
        </Link>
      </div>
    </header>
  );
}

export function ResourcePageFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-parchment"><ResourceMasthead />{children}</div>;
}

export function ResourceImage({ path, alt, className = "", priority = false }: { path: string | null | undefined; alt: string; className?: string; priority?: boolean }) {
  const src = getResourceImageUrl(path);
  if (!src) return <div aria-hidden="true" className={`bg-grain flex items-center justify-center bg-navy-50 ${className}`}><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald">Scholars resource desk</span></div>;
  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className={`object-cover ${className}`} />;
}

export function ResourceCard({ article, featured = false }: { article: ResourceArticleCard; featured?: boolean }) {
  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-card transition-transform duration-300 hover:-translate-y-0.5 ${featured ? "md:grid md:grid-cols-[1.05fr_0.95fr]" : ""}`}>
      {featured && <ResourceImage path={article.featured_image_path} alt={`${article.title} featured image`} priority className="min-h-56 w-full md:h-full" />}
      <div className="flex min-w-0 flex-1 flex-col p-6 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald">
          <span>{article.article_type}</span>
          {article.reading_time_minutes ? <span className="text-navy-light">{article.reading_time_minutes} min read</span> : null}
        </div>
        <h3 className={`mt-4 font-display font-semibold leading-tight text-navy ${featured ? "text-3xl md:text-4xl" : "text-2xl"}`}>
          <Link href={`/resources/${article.slug}`} className="hover:underline">{article.title}</Link>
        </h3>
        {article.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-6 text-navy-light">{article.excerpt}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-7 text-xs text-navy-light">
          <span>By {article.author_name || "Scholars"}</span>
          <Link href={`/resources/${article.slug}`} className="font-semibold text-navy hover:underline">Read guide <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}

export function ResourceEmptyState({ categoryName }: { categoryName?: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white p-8 md:p-12">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber">The desk is growing</p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-navy">{categoryName ? `No published guides in ${categoryName} yet.` : "The first guides are being prepared."}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-navy-light">Check back soon for practical guidance from the Scholars team, or explore verified opportunities while the next guides are reviewed.</p>
      <Link href="/opportunities-for-students" className="mt-6 inline-flex rounded-seal bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Explore opportunities</Link>
    </div>
  );
}

export function ResourceErrorState() {
  return (
    <div role="alert" className="rounded-2xl border border-rose/30 bg-white p-8 md:p-12">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-rose">A quiet moment</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-navy">We could not load the Resource Center.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-navy-light">Please try again shortly. The rest of Scholars is still available while we reconnect to the public resource desk.</p>
      <Link href="/resources" className="mt-6 inline-flex rounded-seal bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Try again</Link>
    </div>
  );
}

export function OpportunityBridge() {
  return (
    <section className="rounded-2xl bg-navy px-6 py-8 text-white md:px-10 md:py-10">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-light">From reading to doing</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight">Turn good guidance into your next application.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">Build one profile and let Scholars surface verified scholarships and opportunities that fit your situation.</p>
        </div>
        <Link href="/signup" className="inline-flex items-center justify-center rounded-seal bg-white px-5 py-3 text-sm font-semibold text-navy hover:bg-parchment">Build your free profile <span aria-hidden="true" className="ml-2">→</span></Link>
      </div>
    </section>
  );
}
