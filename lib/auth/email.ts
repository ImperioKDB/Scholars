// lib/auth/email.ts
// Shared email normalization for every auth form (signup, login, reset).
//
// WHY: "Unable to validate email address: invalid format" from Supabase is
// almost always a stray space or invisible character that a mobile keyboard
// or autocomplete appended to the field. Emails cannot contain unescaped
// whitespace, so GoTrue's validator rejects the whole address even though it
// looks correct on screen. Normalizing client-side removes that entire class
// of failure before the request leaves the browser.
//
// WHAT IT DOES: strips zero-width / invisible characters and ALL whitespace
// (emails never legitimately contain spaces), then lowercases. Local-parts
// are case-sensitive in theory but every major provider treats them
// case-insensitively, so lowercasing the whole address is the pragmatic
// normalization that also matches how a student re-types it later at login.
export function normalizeEmail(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "") // zero-width + nbsp
    .replace(/\s+/g, "")                          // any remaining whitespace
    .toLowerCase();
}
