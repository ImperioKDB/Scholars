"use client";

import { useState } from "react";

type Role = "founder" | "contributor" | "student";

export function CommunityRoleControl({ profileId, initialRole }: { profileId: string; initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function change(next: "student" | "contributor") {
    const previous = role;
    setRole(next);
    setSaving(true);
    setError(false);
    try {
      const response = await fetch("/api/admin/member-roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, community_role: next }),
      });
      if (!response.ok) throw new Error("role_update_failed");
    } catch {
      setRole(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (role === "founder") {
    return <span className="rounded-full bg-amber-light px-2 py-1 text-xs font-medium text-amber">Founder</span>;
  }
  return (
    <label className="inline-flex items-center gap-2 text-xs text-navy-light">
      <span className="sr-only">Community role</span>
      <select
        value={role}
        disabled={saving}
        onChange={(event) => void change(event.target.value as "student" | "contributor")}
        className="rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-navy"
      >
        <option value="student">Student</option>
        <option value="contributor">Contributor</option>
      </select>
      {error && <span className="text-rose">Not saved</span>}
    </label>
  );
}
