"use client";
import { useEffect, useRef, useState } from "react";

export type TestimonialItem = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
};

// components/TestimonialsRotator.tsx
//
// In-place expand replaced per-testimonial detail pages (product decision
// reversed): the quote is clamped to three lines by default per the taste
// doc, and "Read more" expands the full text inside the card while
// "Show less" collapses it again. No navigation, no dead-end pages, no
// extra route to maintain.
//
// Mobile stays a horizontal scroll-snap carousel with a filled segment
// track (same convention as HowItWorksRotator); desktop renders a static
// three-column grid. Expanding one card grows that card only; the track
// height follows the tallest card, which is acceptable and keeps every
// quote reachable without leaving the section.
export function TestimonialsRotator({ items }: { items: TestimonialItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  function initialsFor(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  return (
    <div>
      <div
        ref={trackRef}
        className="flex md:grid md:grid-cols-3 gap-6 md:gap-8 overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-px-6 -mx-6 px-6 md:mx-0 md:px-0 pb-2 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((t, i) => {
          const expanded = expandedId === t.id;
          return (
            <div
              key={t.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="relative shrink-0 w-[85%] sm:w-[60%] md:w-auto snap-start bg-white rounded-2xl border border-hairline shadow-card p-5 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={t.full_name}
                    loading="lazy"
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <span
                    className="w-12 h-12 rounded-xl bg-navy-50 text-navy flex items-center justify-center font-display font-semibold shrink-0"
                    aria-hidden="true"
                  >
                    {initialsFor(t.full_name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-ink text-sm leading-snug">{t.full_name}</p>
                  <p className="text-xs text-navy-light mt-0.5">{t.role}</p>
                </div>
              </div>
              <blockquote
                className={"text-sm text-ink leading-relaxed " + (expanded ? "" : "line-clamp-3")}
              >
                {"“"}
                {t.quote}
                {"”"}
              </blockquote>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : t.id)}
                aria-expanded={expanded}
                className="mt-auto self-start text-xs font-medium text-navy hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex md:hidden items-center gap-1.5 mt-6 px-1" role="tablist" aria-label="Testimonials">
        {items.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => goTo(i)}
            role="tab"
            aria-label={`Go to testimonial ${i + 1}`}
            aria-selected={active === i}
            className={["h-1.5 flex-1 rounded-full", i <= active ? "bg-navy" : "bg-hairline"].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
