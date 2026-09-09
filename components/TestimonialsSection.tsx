import { createPublicClient } from "@/lib/supabase/public";
import { TestimonialsRotator, type TestimonialItem } from "@/components/TestimonialsRotator";

// components/TestimonialsSection.tsx
// Server wrapper for the landing-page social proof band. Reads only
// approved + consented testimonials through the cookie-free public client
// (safe for the ISR landing route) and hands them to the client rotator,
// which now expands quotes in place instead of linking to detail pages.
// Renders nothing when there are no published testimonials yet.
export async function TestimonialsSection() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, quote, full_name, role, photo_url")
    .eq("approved", true)
    .eq("consent", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(6);
  const items = (data ?? []) as TestimonialItem[];
  if (items.length === 0) return null;
  return (
    <section className="border-t border-hairline bg-grain">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-navy mb-8">
          What students say
        </h2>
        <TestimonialsRotator items={items} />
      </div>
    </section>
  );
}
