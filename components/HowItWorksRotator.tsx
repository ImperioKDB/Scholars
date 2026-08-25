"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    name: "Build your profile",
    detail: "Academic level, discipline, GPA, and the details providers actually screen for.",
  },
  {
    name: "See your matches",
    detail: "A ranked list, scored against real eligibility rules — not a keyword search.",
  },
  {
    name: "Keep every deadline",
    detail: "Save the ones you want, and get reminded before they close.",
  },
];

// Mobile: horizontal scroll-snap carousel, user-driven only (no autoplay,
// no opacity/fade animation -- just native browser scrolling, which the
// compositor handles for free). Desktop: reverts to a plain 3-column row
// since there's room to show all three steps at once.
export function HowItWorksRotator() {
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
  }, []);

  function goTo(index: number) {
    cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  return (
    <div>
      <div
        ref={trackRef}
        className="flex md:grid md:grid-cols-3 gap-6 md:gap-10 overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-px-6 -mx-6 px-6 md:mx-0 md:px-0 pb-2 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((step, i) => (
          <div
            key={step.name}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="shrink-0 w-[82%] sm:w-[60%] md:w-auto snap-start border-t-2 border-navy pt-4"
          >
            <p className="font-mono text-xs text-emerald mb-2">0{i + 1}</p>
            <h3 className="font-display text-lg font-semibold text-navy mb-2">{step.name}</h3>
            <p className="text-sm text-navy-light leading-relaxed">{step.detail}</p>
          </div>
        ))}
      </div>

      <div className="flex md:hidden items-center justify-center gap-2 mt-6">
        {STEPS.map((step, i) => (
          <button
            key={step.name}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to step ${i + 1}: ${step.name}`}
            aria-current={active === i}
            className={["h-1.5 rounded-full", active === i ? "w-6 bg-navy" : "w-1.5 bg-hairline"].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
