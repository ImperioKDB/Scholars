import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { initialsFor } from "@/lib/text/initials";
// app/reviews/page.tsx
// GET /reviews -- public, unauthenticated page showing EVERY approved +
// consented student review in full (no clamping, no rotator). The homepage
// rotator shows only four; this is where the rest live, exactly as the
// product owner specified. Same RLS gate as the landing section
// (testimonials_public_read requires approved AND consent), read through
// the cookie-free public client, ISR 300s like the other public pages.
export const metadata: Metadata = {
  title: "Reviews | Scholars",
  description: "What students say about Scholars, in their own words.",
};
export const revalidate = 300;
type Review = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
};
export default async function ReviewsPage() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, quote, full_name, role, photo_url")
    .eq("approved", true)
    .eq("consent", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const reviews = (data ?? []) as Review[];
  return (
    <article>
      <h1 className="font-display text-3xl font-semibold text-navy mb-2">What students say</h1>
      <p className="text-sm text-navy-light mb-10">
        Every review below is a real student quote, published with their permission.
        {reviews.length > 0
          ? ` ${reviews.length} review${reviews.length === 1 ? "" : "s"} and counting.`
          : ""}
      </p>
      {reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-hairline p-8 text-center">
          <p className="text-sm text-navy-light">No reviews published yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="bg-white rounded-2xl border border-hairline shadow-card p-5 md:p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                {r.photo_url ? (
                  <img
                    src={r.photo_url}
                    alt={r.full_name}
                    loading="lazy"
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <span
                    className="w-12 h-12 rounded-xl bg-navy-50 text-navy flex items-center justify-center font-display font-semibold shrink-0"
                    aria-hidden="true"
                  >
                    {initialsFor(r.full_name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-ink text-sm leading-snug">{r.full_name}</p>
                  <p className="text-xs text-navy-light mt-0.5">{r.role}</p>
                </div>
              </div>
              <blockquote className="text-sm text-ink leading-relaxed">
                {"\u201C"}
                {r.quote}
                {"\u201D"}
              </blockquote>
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}
