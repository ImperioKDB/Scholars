// components/TestimonialsRotator.tsx
//
// SMART READ MORE (test feedback): the toggle now renders ONLY when the
// clamped quote is actually cut off. Each blockquote is measured
// (scrollHeight vs clientHeight under line-clamp-) after mount, after
// webfonts settle, and on resize; cards whose full quote already fits
// show no button at all. Expanded cards always show "Show less".
//
// Mobile stays a horizontal scroll-snap carousel with a filled segment
// track; desktop renders a static three-column grid.
// Initials come from the shared lib/text/initials.ts (local copy removed).
"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { initialsFor } from "@/lib/text/initials";
export type TestimonialItem = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
};
export function TestimonialsRotator({ items }: { items: TestimonialItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const quoteRefs = useRef<Map<string, HTMLQuoteElement>>(new Map());
  const [active, setActive] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clampedIds, setClampedIds] = useState<Set<string>>(new Set());
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
  // Measure which quotes are genuinely clamped. Re-runs when the item
  // set changes, when a card collapses (expandedId change re-applies the
  // clamp), and on resize. document.fonts.ready covers the case where
  // fallback metrics briefly make a clamped quote look unclamped.
  useLayoutEffect(() => {
    function measure() {
      const next = new Set<string>();
      quoteRefs.current.forEach((el, id) => {
        if (id === expandedId) return;
        if (el.scrollHeight > el.clientHeight + 1) next.add(id);
      });
      setClampedIds((prev) => {
        if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev;
        return next;
      });
    }
    measure();
    let cancelled = false;
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        if (!cancelled) measure();
      }).catch(() => {});
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [items, expandedId]);
  function goTo(index: number) {
    cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }
  return (
    <div>
      <div
        ref={trackRef}
        className="flex md:grid md:grid-cols-3 gap-6 md:gap-8 overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-px-6 -mx-6 px-6 md:mx-0 md:px-0 pb-2 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((t, i) => {
          const expanded = expandedId === t.id;
          const showToggle = expanded || clampedIds.has(t.id);
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
                ref={(el) => {
                  if (el) quoteRefs.current.set(t.id, el);
                  else quoteRefs.current.delete(t.id);
                }}
                className={"text-sm text-ink leading-relaxed " + (expanded ? "" : "line-clamp-3")}
              >
                {"\u201C"}
                {t.quote}
                {"\u201D"}
              </blockquote>
              {showToggle && (
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  aria-expanded={expanded}
                  className="mt-auto self-start text-xs font-medium text-navy hover:underline"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
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
