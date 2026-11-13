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

export type PasswordRequirement = {
  id: "length" | "lowercase" | "uppercase" | "number" | "common";
  label: string;
  met: boolean;
};

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
  const requirements = getPasswordRequirements(password);
  if (!requirements[0].met) issues.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!requirements[1].met) issues.push("a lowercase letter");
  if (!requirements[2].met) issues.push("an uppercase letter");
  if (!requirements[3].met) issues.push("a number");
  if (!requirements[4].met) issues.push("no common words like 'password' or 'qwerty'");
  return issues;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  const lower = password.toLowerCase();
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: "uppercase", label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { id: "lowercase", label: "One lowercase letter", met: /[a-z]/.test(password) },
    { id: "number", label: "One number", met: /[0-9]/.test(password) },
    { id: "common", label: "No common passwords", met: !COMMON_FRAGMENTS.some((c) => lower.includes(c)) },
  ];
}

export function getPasswordStrength(password: string): {
  label: "Weak" | "Fair" | "Good" | "Strong";
  score: number;
} {
  if (!password) return { label: "Weak", score: 0 };
  const requirements = getPasswordRequirements(password);
  const metCount = requirements.filter((requirement) => requirement.met).length;
  const score = Math.min(4, metCount + (password.length >= 12 ? 1 : 0));
  if (score >= 4) return { label: "Strong", score: 4 };
  if (score >= 3) return { label: "Good", score: 3 };
  if (score >= 2) return { label: "Fair", score: 2 };
  return { label: "Weak", score: 1 };
}
