// lib/auth/password.ts
// Shared password policy, usable in client components (signup / reset
// forms) so users get instant, specific feedback.
//
// AUTH SECURITY AUDIT: true server-side enforcement of signup passwords
// happens in Supabase Auth (their servers validate signUp()), so the
// dashboard settings (minimum length, strong-password enforcement) remain
// the hard backstop. This validator is the UX layer plus a stricter rule
// set than Supabase's default 6-character minimum.
export const PASSWORD_MIN_LENGTH = 8;

const COMMON_FRAGMENTS = [
  "password",
  "passw0rd",
  "qwerty",
  "letmein",
  "welcome",
  "iloveyou",
  "admin",
  "scholars",
  "123456",
];

export function validatePasswordStrength(password: string): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) issues.push("a lowercase letter");
  if (!/[A-Z]/.test(password)) issues.push("an uppercase letter");
  if (!/[0-9]/.test(password)) issues.push("a number");
  const lower = password.toLowerCase();
  if (COMMON_FRAGMENTS.some((c) => lower.includes(c))) {
    issues.push("no common words like 'password' or 'qwerty'");
  }
  return issues;
}
