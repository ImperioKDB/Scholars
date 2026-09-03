"use client";

import { useEffect, useRef, useState } from "react";

// Isolated leaf client component so the rAF count-up loop never re-renders
// AchievementsClient's parent tree (perf convention: isolate perpetual/
// looping animation state in its own microscopic component). Counts from
// 0 to `value` once on mount over ~700ms with an ease-out curve. Respects
// prefers-reduced-motion by rendering the final value immediately instead
// of animating.
export function XpCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || value === 0) {
      setDisplay(value);
      return;
    }

    const duration = 700;
    let frame: number;

    function tick(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current!;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{display}</span>;
}
