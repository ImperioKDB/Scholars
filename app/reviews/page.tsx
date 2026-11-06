import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { initialsFor } from "@/lib/text/initials";
import { pageHref, pageStart, parsePublicPage, PUBLIC_PAGE_SIZE } from "@/lib/public-pagination";

const PATH = "/reviews";
const TITLE = "Reviews";
const DESCRIPTION = "What students say about Scholars, in their own words.";

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

type Review = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
};

export const revalidate = 300;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePublicPage((await searchParams).page);
  const supabase = createPublicClient();
  const { data, count } = await supabase
    .from("testimonials")
    .select("id, quote, full_name, role, photo_url", { count: "exact" })
    .eq("approved", true)
    .eq("consent", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(pageStart(page), pageStart(page) + PUBLIC_PAGE_SIZE - 1);
  const reviews = (data ?? []) as Review[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PUBLIC_PAGE_SIZE));

  return (
    <article>
      <h1 className="font-display text-3xl font-semibold text-navy mb-2">What students say</h1>
      <p className="text-sm text-navy-light mb-10">
        Every review below is a real student quote, published with their permission.
        {count && count > 0 ? ` ${count} review${count === 1 ? "" : "s"} and counting.` : ""}
      </p>
      {reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">No reviews published yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {reviews.map((r) => (
            <figure key={r.id} className="bg-white rounded-2xl border border-hairline shadow-card p-5 md:p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {r.photo_url ? (
                  <img src={r.photo_url} alt={r.full_name} loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                ) : (
                  <span className="w-12 h-12 rounded-xl bg-navy-50 text-navy flex items-center justify-center font-display font-semibold shrink-0" aria-hidden="true">
                    {initialsFor(r.full_name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-ink text-sm leading-snug">{r.full_name}</p>
                  <p className="text-xs text-navy-light mt-1">{r.role}</p>
                </div>
              </div>
              <blockquote className="text-sm text-ink leading-relaxed">
                {"“"}{r.quote}{"”"}
              </blockquote>
            </figure>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label="Review pages" className="mt-8 flex items-center justify-between gap-4 text-sm">
          {page > 1 ? <a href={pageHref(PATH, page - 1)} className="font-medium text-navy underline">Previous</a> : <span />}
          {page < totalPages ? <a href={pageHref(PATH, page + 1)} className="font-medium text-navy underline">Next</a> : <span />}
        </nav>
      )}
    </article>
  );
}
