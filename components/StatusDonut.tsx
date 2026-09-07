// components/StatusDonut.tsx
// Reuses the same stroke-dasharray ring technique as MatchSeal, extended
// to multiple colored segments -- no charting library needed for a single
// 4-category donut.
//
// COLOR CONSISTENCY: segment colors use the darkened WCAG tokens from
// tailwind.config.ts (emerald #15705A, amber #966216, rose #A63A35) instead
// of the old pre-audit hexes, so the donut matches every other status color
// in the app.
type StatusCounts = {
  in_progress: number;
  submitted: number;
  accepted: number;
  rejected: number;
};

const SEGMENTS: { key: keyof StatusCounts; color: string; label: string }[] = [
  { key: "in_progress", color: "#966216", label: "In progress" },
  { key: "submitted", color: "#0B1E3D", label: "Submitted" },
  { key: "accepted", color: "#15705A", label: "Accepted" },
  { key: "rejected", color: "#A63A35", label: "Rejected" },
];

export function StatusDonut({ counts }: { counts: StatusCounts }) {
  const total = counts.in_progress + counts.submitted + counts.accepted + counts.rejected;
  const r = 15.5;
  const c = 2 * Math.PI * r;
  let cumulative = 0;
  const arcs =
    total === 0
      ? []
      : SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => {
          const fraction = counts[s.key] / total;
          const length = fraction * c;
          const arc = { key: s.key, color: s.color, offset: cumulative, length };
          cumulative += length;
          return arc;
        });

  // AUDIT FIX (batch 5): screen readers used to get raw SVG circles with
  // no meaning. role="img" + a spoken summary replaces that; the visible
  // legend still renders for sighted users.
  const ariaSummary = `Application status: ${counts.in_progress} in progress, ${counts.submitted} submitted, ${counts.accepted} accepted, ${counts.rejected} rejected, ${total} total`;
  return (
    <div className="flex items-center gap-6 flex-wrap" role="img" aria-label={ariaSummary}>
      <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
        <svg viewBox="0 0 40 40" width={96} height={96} className="-rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" stroke="#E4E1D8" strokeWidth="5" />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth="5"
              strokeDasharray={`${a.length} ${c - a.length}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-semibold text-navy">{total}</span>
          <span className="text-[10px] text-navy-light">total</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm min-w-[160px]">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-navy-light">{s.label}</span>
            <span className="font-mono text-ink ml-auto">{counts[s.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
