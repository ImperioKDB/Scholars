// components/Avatar.tsx
// Initials-based avatar used by admin surfaces (ActiveUsersTable). Matches
// the call signature introduced in 90105e0: userId, fullName, size,
// className. Deliberately photo-free: admin lists would otherwise need one
// storage lookup per row, and initials on the house palette read cleanly at
// table density. Same tone-hash idea as ProviderMonogram so colors stay
// stable per person.
import { initialsFor } from "@/lib/text/initials";
const PALETTE = [
  { bg: "bg-navy-50", text: "text-navy" },
  { bg: "bg-emerald-light", text: "text-emerald" },
  { bg: "bg-amber-light", text: "text-amber" },
  { bg: "bg-rose-light", text: "text-rose" },
] as const;
function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
export type AvatarSize = "small" | "medium" | "large";
const SIZE_CLASSES: Record<AvatarSize, string> = {
  small: "h-8 w-8 text-xs",
  medium: "h-10 w-10 text-sm",
  large: "h-12 w-12 text-base",
};
export function Avatar({
  userId,
  fullName,
  size = "medium",
  className = "",
}: {
  userId?: string;
  fullName?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const name = fullName ?? "";
  const seed = name || userId || "user";
  const tone = toneFor(seed);
  return (
    <span
      role="img"
      aria-label={name ? `${name} avatar` : "User avatar"}
      className={[
        "inline-flex items-center justify-center rounded-full font-display font-semibold shrink-0 select-none",
        SIZE_CLASSES[size],
        tone.bg,
        tone.text,
        className,
      ].join(" ")}
    >
      {initialsFor(name)}
    </span>
  );
}
export default Avatar;
