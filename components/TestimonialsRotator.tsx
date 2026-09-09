"use client";
import { useEffect, useRef, useState } from "react";

// components/TestimonialsRotator.tsx
//
// Mobile-first testimonial carousel, rebuilt against the Frontend-for-
// Mobile skill's rules:
//   - Peeking cards (w-[85%] on phones) so the next quote is always partly
//     visible and the swipe is discoverable without a hint label.
//   - snap-x snap-mandatory scroll-snap, user-driven only (no autoplay),
//     so dragging never fights the user and reduced-motion only collapses
//     the programmatic smooth scroll, never the native gesture.
//   - Edge fade masks in the section background color signal "more here"
//     and current position; they fade out at the ends so they never lie.
//   - Segment progress buttons carry ~44px hit areas (visual bar stays
//     thin inside), replacing the old ~6px dots.
//   - Fixed square media frame per photo (object-cover) with an initials
//     monogram fallback in the same frame, so layout never shifts.
//   - Quote at text-base with real typographic quotes, clamped to three
//     lines per the taste doc; attribution kept at readable sizes.
//   - Desktop shows three calc-width cards with horizontal scroll plus
//     44px arrow buttons, so >3 quotes stay reachable without swipe.
export type TestimonialItem = {
  id: string;
  quote: string;
  fullName: string;
  role: string;
  photoUrl: string | null;
};

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function TestimonialsRotator({ items }: { items: TestimonialItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

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
    const clamped = Math.min(Math.max(index, 0), items.length - 1);
    cardRefs.current[clamped]?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      inline: "start",
      block: "nearest",
    });
  }

  const atStart = active === 0;
  const atEnd = active === items.length - 1;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className={
          "pointer-events-none absolute inset-y-0 left-0 w-6 md:w-10 bg-gradient-to-r from-parchment to-transparent transition-opacity " +
          (atStart ? "opacity-0" : "opacity-100")
        }
      />
      <div
        aria-hidden="true"
        className={
          "pointer-events-none absolute inset-y-0 right-0 w-6 md:w-10 bg-gradient-to-l from-parchment to-transparent transition-opacity " +
          (atEnd ? "opacity-0" : "opacity-100")
        }
      />

      <div
        ref={trackRef}
        className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-px-6 -mx-6 px-6 md:mx-0 md:px-0 md:scroll-px-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((t, i) => (
          <div
            key={t.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="relative shrink-0 w-[85%] sm:w-[60%] md:w-[calc(33.333%-16px)] snap-start bg-white rounded-2xl border border-hairline shadow-card p-5 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              {t.photoUrl ? (
                <img
                  src={t.photoUrl}
                  alt={t.fullName}
                  loading="lazy"
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              ) : (
                <span
                  className="w-12 h-12 rounded-xl bg-navy-50 text-navy flex items-center justify-center font-display font-semibold shrink-0"
                  aria-hidden="true"
                >
                  {initialsFor(t.fullName)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{t.fullName}</p>
                <p className="text-xs text-navy-light truncate">{t.role}</p>
              </div>
            </div>
            <blockquote className="text-base leading-relaxed text-ink line-clamp-3">
              {"“"}
              {t.quote}
              {"”"}
            </blockquote>
          </div>
        ))}
      </div>

      <div className="flex md:hidden items-center gap-1.5 mt-4 px-1" role="tablist" aria-label="Testimonials">
        {items.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => goTo(i)}
            role="tab"
            aria-label={`Go to testimonial ${i + 1} of ${items.length}`}
            aria-selected={active === i}
            className="flex-1 py-3 -my-3"
          >
            <span
              className={
                "block h-1.5 rounded-full transition-colors " +
                (i <= active ? "bg-navy" : "bg-hairline")
              }
            />
          </button>
        ))}
      </div>

      <div className="hidden md:flex items-center justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={() => goTo(active - 1)}
          disabled={atStart}
          aria-label="Previous testimonial"
          className="w-11 h-11 rounded-full border border-hairline bg-white text-navy flex items-center justify-center hover:bg-navy-50 transition-colors disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          disabled={atEnd}
          aria-label="Next testimonial"
          className="w-11 h-11 rounded-full border border-hairline bg-white text-navy flex items-center justify-center hover:bg-navy-50 transition-colors disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
