"use client";

import { useEffect, useRef, useState } from "react";

// components/MatchSeal.tsx
// The signature eligibility ring. The score counts up once when the seal
// first enters the viewport. Reduced motion (or no IntersectionObserver)
// shows the final score immediately. The ring itself is static (drawn
// from the final score) so the only animated property is the number text.
//
// PERF (batch 1): a single module-level IntersectionObserver now serves
// every seal on the page. The previous version created one observer per
// seal, so a 30-card dashboard grid created 30. Seals subscribe by
// observing their own element and listening for a "seal-visible" event
// the shared observer dispatches.
function ringColor(score: number): string {
  if (score >= 80) return "#15705A"; // emerald  -- excellent
  if (score >= 60) return "#966216"; // amber    -- worth a look
  if (score >= 40) return "#14315C"; // navy     -- possible
  return "#A63A35";                  // rose     -- long shot
}

let sharedObserver: IntersectionObserver | undefined;

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
    return null;
  }
  if (sharedObserver === undefined) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            sharedObserver!.unobserve(entry.target);
            entry.target.dispatchEvent(new Event("seal-visible"));
          }
        }
      },
      { threshold: 0.4 }
    );
  }
  return sharedObserver;
}

function SealNumber({ score }: { score: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);

  // Kick off when the seal scrolls into view (once), via the shared
  // observer. Falls back to an immediate start when IO is unavailable.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setStarted(true);
      return;
    }
    const observer = getSharedObserver();
    if (!observer) {
      setStarted(true);
      return;
    }
    const onVisible = () => setStarted(true);
    el.addEventListener("seal-visible", onVisible);
    observer.observe(el);
    return () => {
      el.removeEventListener("seal-visible", onVisible);
      observer.unobserve(el);
    };
  }, []);

  // rAF count-up, ease-out cubic, ~700ms, isolated in this leaf so the
  // loop never re-renders the card tree. Reduced motion jumps straight
  // to the final value.
  useEffect(() => {
    if (!started) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(score);
      return;
    }
    const dur = 700;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(score * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, score]);

  return <span ref={ref}>{display}</span>;
}

export function MatchSeal({ score, size = 52 }: { score: number; size?: number }) {
  const stroke = Math.max(3, Math.round(size * 0.08));
  const r = size / 2 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color = ringColor(score);

  return (
    <div
      role="img"
      aria-label={`${score}% match`}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4E1D8" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono font-semibold text-navy" style={{ fontSize: size * 0.32 }}>
          <SealNumber score={score} />
        </span>
      </div>
    </div>
  );
}
