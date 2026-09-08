// components/StatusMessage.tsx
//
// Accessible status message wrapper (audit P9 - quick win).
// Screen readers need aria-live="polite" to announce state changes like
// "Photo saved", "Couldn't load", "Already saved". This component wraps
// those messages so they're announced automatically.
//
// USAGE:
//   <StatusMessage tone="success">{notice}</StatusMessage>
//   <StatusMessage tone="error">{error}</StatusMessage>
export function StatusMessage({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "success" | "error" | "neutral";
}) {
  if (!children) return null;
  const toneClass =
    tone === "success" ? "text-emerald" : tone === "error" ? "text-rose" : "text-navy-light";
  return (
    <p role="status" aria-live="polite" className={`text-xs ${toneClass}`}>
      {children}
    </p>
  );
}
