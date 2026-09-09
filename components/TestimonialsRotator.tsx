"use client";
import { useEffect, useRef, useState } from "react";

// components/TestimonialsRotator.tsx
//
// Horizontal scroll-snap rotator for student testimonials. Replaces the
// previous vertical stack, which buried every voice after the first and
// stretched the section to three screenfuls on a phone.
//
// Conventions kept cohesive with components/HowItWorksRotator.tsx:
//   - User-driven only (native scroll-snap, no autoplay, no perpetual
//     loop), so there is nothing to interrupt and nothing nagging.
//   - prefers-reduced-motion collapses programmatic scrolling to instant
//     jumps; native swipe still works because it is the user's own gesture.
//   - Progress is an active-pill row, not dots: dots are small tap targets
//     and do not communicate position the way a widened active pill does.
//   - Peeking card widths (85 / 46 / 31 percent) keep the next card partly
//     visible so the swipe affordance is obvious without a hint label.
//
// Cards carry the student's published photo (permission on file), a quote
// clamped to three lines per the taste doc, and name + role attribution.
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

  // Track which card is centered so the pills and arrows stay in sync with
  // manual swipes, not just with button clicks.
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

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={() => goTo(active - 1)}
          disabled={active === 0}
          aria-label="Previous testimonial"
          className="flex items-center justify-center w-10 h-10 rounded-full border border-hairline bg-white text-navy hover:bg-navy-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          disabled={active === items.length - 1}
          aria-label="Next testimonial"
          className="flex items-center justify-center w-10 h-10 rounded-full border border-hairline bg-white text-navy hover:bg-navy-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div
        ref={trackRef}
        role="group"
        aria-label="Student testimonials"
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-6 -mx-6 px-6 md:mx-0 md:px-0 md:scroll-px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="relative shrink-0 w-[85%] sm:w-[60%] md:w-[46%] lg:w-[31%] snap-start bg-white rounded-2xl border border-hairline shadow-card p-5 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              {item.photoUrl ? (
                <img
                  src={item.photoUrl}
                  alt={item.fullName}
                  loading="lazy"
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
              ) : (
                <span
                  className="w-16 h-16 rounded-xl bg-navy-50 text-navy flex items-center justify-center font-display font-semibold shrink-0"
                  aria-hidden="true"
                >
                  {initialsFor(item.fullName)}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-medium text-ink text-sm leading-snug">{item.fullName}</p>
                <p className="text-xs text-navy-light mt-0.5">{item.role}</p>
              </div>
            </div>
            <blockquote className="font-display text-base md:text-lg leading-snug text-navy line-clamp-3">
              {"“"}
              {item.quote}
              {"”"}
            </blockquote>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-5" role="tablist" aria-label="Testimonial position">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Go to testimonial ${i + 1}`}
            onClick={() => goTo(i)}
            className={[
              "h-1.5 rounded-full transition-all",
              i === active ? "w-6 bg-navy" : "w-1.5 bg-hairline hover:bg-navy-light",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
