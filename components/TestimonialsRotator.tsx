"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// components/TestimonialsRotator.tsx
// Horizontal scroll-snap carousel of approved student testimonials.
// Each card is a full-card Link to its public detail page
// (/testimonials/<id>) so the clamped 3-line quote is a teaser, not the
// whole story; a small "Read full story" line makes the tap target
// discoverable rather than relying on users guessing the card is tappable.
// Progress is a filled segment track (dots have small tap targets and
// don't communicate position as clearly). User-driven only: no autoplay.
export type TestimonialItem = {
  id: string;
  full_name: string;
  role: string;
  quote: string;
  photo_url: string | null;
};

export function TestimonialsRotator({ items }: { items: TestimonialItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActive(idx);
          }
        });
      },
      { root: track, threshold: 0.6 }
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  function goTo(index: number) {
    cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  return (
    <div>
      <div
        ref={trackRef}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-px-6 -mx-6 px-6 gap-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((t, i) => (
          <div
            key={t.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="relative shrink-0 w-[85%] sm:w-[60%] md:w-[31%] snap-start"
          >
            <Link
              href={`/testimonials/${t.id}`}
              className="flex flex-col h-full bg-white rounded-2xl border border-hairline shadow-card p-5 hover:border-navy/30 transition-colors focus-visible:ring-2 focus-visible:ring-emerald focus-visible:outline-none"
            >
              <div className="flex items-center gap-3 mb-4">
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={t.full_name}
                    loading="lazy"
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <span
                    className="w-14 h-14 rounded-xl bg-navy-50 text-navy flex items-center justify-center font-display font-semibold shrink-0"
                    aria-hidden="true"
                  >
                    {t.full_name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-ink leading-snug">{t.full_name}</p>
                  <p className="text-sm text-navy-light">{t.role}</p>
                </div>
              </div>
              <blockquote className="text-sm text-ink leading-relaxed line-clamp-3">
                {"“"}
                {t.quote}
                {"”"}
              </blockquote>
              <span className="mt-auto pt-3 text-xs font-medium text-navy">
                Read full story &rarr;
              </span>
            </Link>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-6 px-1" role="tablist" aria-label="Testimonials">
        {items.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => goTo(i)}
            role="tab"
            aria-label={`Go to testimonial ${i + 1}: ${t.full_name}`}
            aria-selected={active === i}
            className={["h-1.5 flex-1 rounded-full", i <= active ? "bg-navy" : "bg-hairline"].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
