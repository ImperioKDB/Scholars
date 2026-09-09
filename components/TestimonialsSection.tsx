import { createPublicClient } from "@/lib/supabase/public";
import { TestimonialsRotator, type TestimonialItem } from "@/components/TestimonialsRotator";

// components/TestimonialsSection.tsx
// Server wrapper for the landing-page social proof band. Fetches only
// approved + consented testimonials through the cookie-free public client
// (safe for the ISR landing route) and hands them to the client rotator.
// Returns null when there are none, so the band never renders empty.
// Section sits on the parchment grain texture so the band reads tactile
// rather than sterile flat white, per the mobile skill's surface rule.
type DbRow = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
};

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
  const rows = (data ?? []) as DbRow[];
  if (rows.length === 0) return null;
  const items: TestimonialItem[] = rows.map((r) => ({
    id: r.id,
    quote: r.quote,
    fullName: r.full_name,
    role: r.role,
    photoUrl: r.photo_url,
  }));
  return (
    <section className="border-t border-hairline bg-grain">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-navy mb-8 md:mb-10">
          What students say
        </h2>
        <TestimonialsRotator items={items} />
      </div>
    </section>
  );
}
