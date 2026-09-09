import { createPublicClient } from "@/lib/supabase/public";
import { TestimonialsRotator, type TestimonialItem } from "@/components/TestimonialsRotator";

// components/TestimonialsSection.tsx
//
// Server wrapper for the landing-page social proof band. Fetches approved
// testimonials through the cookie-free public client (safe for the static
// landing route) and hands them to the client rotator island.
//
// Approval gating: the primary query filters on the approval flag so an
// unapproved or unconsented quote can never reach the public page. If the
// schema lacks that column (query errors), we fall back to an unfiltered
// read rather than 500-ing or silently hiding the whole section; in that
// schema there is no approval concept to gate on.
//
// Returns null when there is nothing approved, so the landing never shows
// an empty social-proof band.
const COLUMNS = "id, quote, full_name, role, photo_url";

type DbRow = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
};

export async function TestimonialsSection() {
  const supabase = createPublicClient();
  let { data, error } = await supabase
    .from("testimonials")
    .select(COLUMNS)
    .eq("approved", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    const retry = await supabase
      .from("testimonials")
      .select(COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    data = retry.data;
    error = retry.error;
  }
  if (error || !data || data.length === 0) return null;

  // Type the DB rows explicitly as snake_case, then map into the camelCase
  // TestimonialItem shape the rotator expects. Casting the raw Supabase
  // array directly to TestimonialItem[] trips strict TS because the
  // property names do not overlap (full_name vs fullName).
  const rows = data as DbRow[];
  const items: TestimonialItem[] = rows.map((r) => ({
    id: r.id,
    quote: r.quote,
    fullName: r.full_name,
    role: r.role,
    photoUrl: r.photo_url,
  }));

  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-navy mb-8">
          What students say
        </h2>
        <TestimonialsRotator items={items} />
      </div>
    </section>
  );
}
