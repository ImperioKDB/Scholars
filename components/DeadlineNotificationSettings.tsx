"use client";

import { useState } from "react";

const channels = [
  { field: "deadline_in_app_enabled", label: "In-app notifications" },
  { field: "deadline_push_enabled", label: "Push on enabled devices" },
  { field: "deadline_email_enabled", label: "Email" },
] as const;
export type DeadlinePreferences = Record<(typeof channels)[number]["field"], boolean>;

export function DeadlineNotificationSettings({ initial }: { initial: DeadlinePreferences }) {
  const [preferences, setPreferences] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = channels.some(({ field }) => preferences[field] !== saved[field]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) throw new Error("Could not save deadline preferences");
      setSaved(preferences);
      setMessage("Deadline preferences saved.");
    } catch {
      setMessage("Could not save deadline preferences. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset id="deadline-reminders" disabled={saving} className="space-y-3">
      <legend className="sr-only">Deadline reminders</legend>
      <p className="text-sm text-navy-light">For scholarships and opportunities you save or track.</p>
      {channels.map(({ field, label }) => (
        <label key={field} className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={preferences[field]}
            onChange={(event) => {
              setPreferences({ ...preferences, [field]: event.target.checked });
              setMessage("");
            }}
          />
          {label}
        </label>
      ))}
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() => void save()}
        className="rounded-seal bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
      {message && <p role="status" className="text-sm text-navy">{message}</p>}
    </fieldset>
  );
}
