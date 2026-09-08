import { createPublicClient } from "@/lib/supabase/public";

// components/TestimonialsSection.tsx
// Public social proof section for the landing page. Server component:
// reads only rows the public RLS policy returns (approved AND consent),
// so this file cannot leak a draft even if it wanted to.
//
// Layout per the design read: asymmetric featured-plus-two, never three
// identical cards. Featured card pairs a square editorial portrait with a
// Fraunces quote in real typographic quote marks; compact cards use a small
// square thumb and a three-line clamped quote. Attribution is always name
// plus role. Entrance reuses the existing reduced-motion-gated
// animate-card-in stagger from app/globals.css.
//
// Returns null when there are no published testimonials, so the landing
// page never shows an empty social-proof box.
type Testimonial = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
};

function Portrait({ row, className }: { row: Testimonial; className: string }) {
  if (!row.photo_url) {
    return (
      <span
        className={`bg-navy-50 border border-hairline flex items-center justify-center font-display font-semibold text-navy ${className}`}
        aria-hidden="true"
      >
        {row.full_name.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={row.photo_url}
      alt={`${row.full_name}, ${row.role}`}
      className={`object-cover ${className}`}
    />
  );
}

export async function TestimonialsSection() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, quote, full_name, role, photo_url")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(3);
  const rows = (data ?? []) as Testimonial[];
  if (rows.length === 0) return null;
  const [featured, ...rest] = rows;

  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-navy mb-10">
          What students say
        </h2>
        <div className="animate-card-in bg-white rounded-2xl border border-hairline shadow-card p-6 md:p-8 grid md:grid-cols-[2fr_3fr] gap-6 items-center">
          <Portrait row={featured} className="w-full aspect-square rounded-2xl" />
          <div>
            <blockquote className="font-display text-xl md:text-2xl leading-snug text-navy">
              &ldquo;{featured.quote}&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-navy-light">
              <span className="font-medium text-navy">{featured.full_name}</span>, {featured.role}
            </p>
          </div>
        </div>
        {rest.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {rest.map((row, i) => (
              <div
                key={row.id}
                className="animate-card-in bg-white rounded-2xl border border-hairline shadow-card p-5 flex items-start gap-4"
                style={{ animationDelay: `${(i + 1) * 60}ms` }}
              >
                <Portrait row={row} className="w-14 h-14 rounded-xl shrink-0" />
                <div className="min-w-0">
                  <blockquote className="text-sm text-ink leading-relaxed line-clamp-3">
                    &ldquo;{row.quote}&rdquo;
                  </blockquote>
                  <p className="mt-2 text-xs text-navy-light">
                    <span className="font-medium text-navy">{row.full_name}</span>, {row.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
