"use client";

import { getPasswordRequirements, getPasswordStrength } from "@/lib/auth/password";

const STRENGTH_STYLES = {
  Weak: { text: "text-rose", fill: "bg-rose" },
  Fair: { text: "text-amber", fill: "bg-amber" },
  Good: { text: "text-emerald", fill: "bg-emerald" },
  Strong: { text: "text-emerald", fill: "bg-emerald" },
} as const;

export function PasswordRequirements({ password }: { password: string }) {
  if (!password) return null;

  const requirements = getPasswordRequirements(password);
  const strength = getPasswordStrength(password);
  const style = STRENGTH_STYLES[strength.label];

  return (
    <div className="mt-3 rounded-lg border border-hairline bg-navy-50 p-3.5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-navy">Password strength</span>
        <span className={`text-xs font-semibold ${style.text}`}>{strength.label}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={`h-1.5 flex-1 rounded-full ${segment <= strength.score ? style.fill : "bg-hairline"}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-xs text-navy-light sm:grid-cols-2">
        {requirements.map((requirement) => (
          <li key={requirement.id} className={`flex items-center gap-1.5 ${requirement.met ? "text-emerald" : ""}`}>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {requirement.met ? "✓" : "○"}
            </span>
            <span>{requirement.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
