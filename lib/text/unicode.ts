// lib/text/unicode.ts
// Decodes literal \uXXXX escape sequences pasted into free-text fields.
// Extracted from two identical copies in app/api/admin/scholarships/route.ts
// and .../[id]/route.ts so a future fix (e.g. handling \\u{...} braces)
// lands everywhere at once. A row once arrived with amount stored as the
// six ASCII chars "\u20a6150,000" instead of the real naira sign;
// transforming on write means the catalog can never re-accumulate literal
// escapes from a bad paste or seed.
export function decodeUnicodeEscapes(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}
