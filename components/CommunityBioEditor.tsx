"use client";

import { useState } from "react";

export function CommunityBioEditor({ initialBio }: { initialBio: string | null }) {
  const [bio, setBio] = useState(initialBio ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveBio() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ community_bio: bio.trim() || null }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "We couldn't save your bio. Try again.");
        return;
      }
      setBio(payload?.profile?.community_bio ?? bio.trim());
      setNotice("Bio saved.");
    } catch {
      setError("We couldn't reach Scholars. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label htmlFor="community-bio" className="block text-sm font-medium text-ink">Short bio</label>
      <p className="mt-1 text-xs leading-relaxed text-navy-light">
        Optional. This appears when another student taps your name on a public community post. Never include contact details.
      </p>
      <textarea
        id="community-bio"
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        maxLength={280}
        rows={4}
        placeholder="e.g. I study computer science and share what I learn while applying."
        className="mt-3 min-h-[104px] w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm leading-relaxed text-ink"
        disabled={saving}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-navy-light">{bio.length}/280</p>
        <button
          type="button"
          onClick={saveBio}
          disabled={saving}
          className="rounded-seal bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save bio"}
        </button>
      </div>
      {notice && <p className="mt-2 text-sm text-emerald" role="status">{notice}</p>}
      {error && <p className="mt-2 text-sm text-rose" role="alert">{error}</p>}
    </div>
  );
}
