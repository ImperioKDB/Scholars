"use client";

import { useEffect, useRef, useState } from "react";

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.8 4.4-6 7.5-6s6.1 2.2 7.5 6" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" strokeLinejoin="round" />
      <path d="M10 18.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

const STEPS = [
  {
    name: "Build your profile",
    detail: "Academic level, discipline, GPA, and the details providers actually screen for.",
    Icon: ProfileIcon,
  },
  {
    name: "See your matches",
    detail: "A ranked list, scored against real eligibility rules — not a keyword search.",
    Icon: TargetIcon,
  },
  {
    name: "Keep every deadline",
    detail: "Save the ones you want, and get reminded before they close.",
    Icon: BellIcon,
  },
];

// Mobile: horizontal scroll-snap carousel, user-driven only (no autoplay,
// no opacity/fade animation -- just native browser scrolling). Progress is
// shown as a filled 3-segment track rather than plain dots: research on
// stepper/carousel UX (UXPin, Smashing Magazine, Foundey) flags two dot
// weaknesses this fixes -- dots have tiny, hard-to-hit tap targets, and
// isolated dots don't communicate "how far along" the way a filled
// connecting bar does. Desktop keeps the plain 3-column row.
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
            className="relative shrink-0 w-[82%] sm:w-[60%] md:w-auto snap-start border-t-2 border-navy pt-4 overflow-hidden"
          >
            {/* ghost numeral -- purely typographic, no motion */}
            <span
              aria-hidden="true"
              className="pointer-events-none select-none absolute -top-2 right-0 font-display text-8xl font-semibold text-navy/5"
            >
              0{i + 1}
            </span>

            <div className="relative flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-light text-emerald shrink-0">
                <step.Icon />
              </span>
              <p className="font-mono text-xs text-emerald">0{i + 1}</p>
            </div>

            <h3 className="relative font-display text-lg font-semibold text-navy mb-2">{step.name}</h3>
            <p className="relative text-sm text-navy-light leading-relaxed">{step.detail}</p>
          </div>
        ))}
      </div>

      <div className="flex md:hidden items-center gap-1.5 mt-6 px-1" role="tablist" aria-label="How it works steps">
        {STEPS.map((step, i) => (
          <button
            key={step.name}
            type="button"
            onClick={() => goTo(i)}
            role="tab"
            aria-label={`Go to step ${i + 1}: ${step.name}`}
            aria-selected={active === i}
            className={["h-1.5 flex-1 rounded-full", i <= active ? "bg-navy" : "bg-hairline"].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
