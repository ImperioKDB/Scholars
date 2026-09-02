// components/CompetitivenessBadge.tsx
//
// Transparency block for the scholarship detail page: shows why the
// combined match score (see lib/matching/engine.ts) might be lower than
// pure eligibility would suggest. Stays quiet (renders nothing) when no
// competitiveness data has been researched yet -- an "unknown" badge on
// every unresearched scholarship would just be noise, and unresearched
// never means penalized (see engine.ts's computeCompetitivenessFactor).

export type CompetitivenessTier = "low" | "medium" | "high" | "very_high";

type Props = {
  awardsAvailable: number | null;
  estimatedApplicantPool: number | null;
  competitivenessTier: CompetitivenessTier | null;
  historicalAcceptanceRate: number | null;
};

const TIER_COPY: Record<CompetitivenessTier, { label: string; tone: string }> = {
  low: { label: "Low competition", tone: "bg-emerald-light text-emerald" },
  medium: { label: "Moderate competition", tone: "bg-amber-light text-amber" },
  high: { label: "High competition", tone: "bg-rose-light text-rose" },
  very_high: { label: "Extremely competitive", tone: "bg-rose-light text-rose" },
};

// Presentation-only bucketing for badge color/wording when an admin has
// entered awards/pool numbers but no explicit tier -- separate from (and
// coarser than) the continuous factor lib/matching/engine.ts actually
// scores with. This never affects the score itself, only how the ratio is
// described here.
function ratioTier(awards: number, pool: number): CompetitivenessTier {
  const ratio = awards / pool;
  if (ratio >= 0.15) return "low";
  if (ratio >= 0.05) return "medium";
  if (ratio >= 0.02) return "high";
  return "very_high";
}

export function CompetitivenessBadge({
  awardsAvailable,
  estimatedApplicantPool,
  competitivenessTier,
  historicalAcceptanceRate,
}: Props) {
  const hasRatio = awardsAvailable !== null && estimatedApplicantPool !== null && estimatedApplicantPool > 0;
  const effectiveTier: CompetitivenessTier | null =
    competitivenessTier ?? (hasRatio ? ratioTier(awardsAvailable as number, estimatedApplicantPool as number) : null);

  if (!effectiveTier && historicalAcceptanceRate === null) return null;

  const copy = effectiveTier
    ? TIER_COPY[effectiveTier]
    : { label: "Competitiveness researched", tone: "bg-navy-50 text-navy-light" };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${copy.tone}`}>{copy.label}</span>
      {hasRatio && (
        <span className="text-xs text-navy-light font-mono">
          ~{(awardsAvailable as number).toLocaleString()} spot{awardsAvailable === 1 ? "" : "s"} &middot; ~
          {(estimatedApplicantPool as number).toLocaleString()} applicants
        </span>
      )}
      {historicalAcceptanceRate !== null && (
        <span className="text-xs text-navy-light font-mono">
          ~{Math.round(historicalAcceptanceRate * 100)}% historical acceptance
        </span>
      )}
    </div>
  );
}
