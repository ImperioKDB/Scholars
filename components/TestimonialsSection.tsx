import { createPublicClient } from "@/lib/supabase/public";
import { TestimonialsRotator, type TestimonialItem } from "@/components/TestimonialsRotator";

// components/TestimonialsSection.tsx
// Landing-page social proof band. Reads only approved + consented rows
// through the cookie-free public client (safe for the ISR landing route),
// so an unapproved or unconsented testimonial can never render publicly.
// Renders nothing when there are no published testimonials yet.
export async function TestimonialsSection() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, full_name, role, quote, photo_url")
    .eq("approved", true)
    .eq("consent", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const items = (data ?? []) as TestimonialItem[];
  if (items.length === 0) return null;
  return (
    <section id="testimonials" className="border-t border-hairline bg-grain">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-navy mb-8">
          What students say
        </h2>
        <TestimonialsRotator items={items} />
      </div>
    </section>
  );
}
