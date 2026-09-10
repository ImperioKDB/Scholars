import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { TestimonialsRotator, type TestimonialItem } from "@/components/TestimonialsRotator";

// components/TestimonialsSection.tsx
// Server wrapper for the landing-page social proof band. Product decision:
// exactly FOUR reviews in the rotator on the homepage -- enough to prove
// real students use this without turning the landing into a wall of quotes.
// When more approved+consented reviews exist, a "See more reviews" link
// below the rotator leads to /reviews, where every review lives in full.
// Renders nothing at all when there are no published reviews yet.
const HOMEPAGE_COUNT = 4;

export async function TestimonialsSection() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, quote, full_name, role, photo_url")
    .eq("approved", true)
    .eq("consent", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const all = (data ?? []) as TestimonialItem[];
  if (all.length === 0) return null;
  const items = all.slice(0, HOMEPAGE_COUNT);
  const hasMore = all.length > HOMEPAGE_COUNT;
  return (
    <section className="border-t border-hairline bg-grain">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-navy mb-8">
          What students say
        </h2>
        <TestimonialsRotator items={items} />
        {hasMore && (
          <div className="mt-8 text-center">
            <Link
              href="/reviews"
              className="inline-flex items-center gap-2 rounded-seal border border-hairline bg-white text-navy text-sm font-medium px-6 py-2.5 hover:bg-navy-50 hover:border-navy/20 transition-colors"
            >
              See more reviews
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
