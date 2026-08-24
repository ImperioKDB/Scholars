// components/ProviderMonogram.tsx
// A quiet, generated stand-in for a provider logo -- we don't have rights to
// display real scholarship providers' logos, and this keeps every card's
// left slot visually consistent (MatchSeal for scored cards, this for
// unscored ones, e.g. the Saved section) without adding a second
// competing signature element.

const PALETTE = [
  { bg: "bg-navy-50", text: "text-navy" },
  { bg: "bg-emerald-light", text: "text-emerald" },
  { bg: "bg-amber-light", text: "text-amber" },
  { bg: "bg-rose-light", text: "text-rose" },
] as const;

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function ProviderMonogram({ name, size = 52 }: { name: string; size?: number }) {
  const tone = toneFor(name);
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-display font-semibold ${tone.bg} ${tone.text}`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </div>
  );
}
