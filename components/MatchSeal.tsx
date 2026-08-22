const TIERS = [
  { min: 85, ring: "#1B8A6B", text: "text-emerald", label: "Excellent fit" },
  { min: 65, ring: "#C98A2E", text: "text-amber", label: "Worth a look" },
  { min: 0, ring: "#8B93A3", text: "text-navy-light", label: "Long shot" },
] as const;

function tierFor(score: number) {
  return TIERS.find((t) => score >= t.min)!;
}

export function MatchSeal({
  score,
  size = 56,
}: {
  score: number;
  size?: number;
}) {
  const tier = tierFor(score);
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${score} percent match, ${tier.label}`}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#E4E1D8" strokeWidth="2.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={tier.ring}
          strokeWidth="2.5"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono font-semibold text-ink" style={{ fontSize: size * 0.24 }}>
        {score}
        <span className="text-[0.6em] align-top">%</span>
      </span>
    </div>
  );
}
