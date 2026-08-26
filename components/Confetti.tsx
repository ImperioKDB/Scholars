"use client";

import { useEffect, useState } from "react";

const COLORS = ["#0B1E3D", "#1B8A6B", "#C98A2E", "#B4433E", "#14315C"];

type Piece = {
  id: number;
  left: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rounded: boolean;
};

// One-shot celebratory burst -- deliberately not a general-purpose UI
// animation, and not meant to be reused for ambient decoration. Used once:
// when a student finishes onboarding with a 100% complete profile.
// Auto-removes itself after durationMs; renders nothing after that.
export function Confetti({ pieceCount = 60, durationMs = 2600 }: { pieceCount?: number; durationMs?: number }) {
  const [visible, setVisible] = useState(true);
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: pieceCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      duration: 2 + Math.random() * 1.2,
      delay: Math.random() * 0.4,
      rounded: Math.random() > 0.5,
    }))
  );

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[100]" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.rounded ? "9999px" : "2px",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
