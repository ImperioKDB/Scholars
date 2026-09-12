// lib/text/initials.ts
// Single source of truth for monogram initials. Previously duplicated in
// ProviderMonogram, Sidebar, app/reviews/page.tsx and
// TestimonialsRotator: four copies that had already begun to drift (the
// Sidebar version accepted null, the others only string).
//
// Contract:
//   - null / empty / whitespace-only  -> "?"
//   - single word                     -> first two letters, uppercased
//   - multiple words                  -> first letter of first two words
export function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
