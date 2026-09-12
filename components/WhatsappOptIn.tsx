"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { StatusMessage } from "@/components/StatusMessage";
// components/WhatsappOptIn.tsx
//
// Phase 1 consent capture: a dashboard banner offering WhatsApp deadline
// reminders. It records consent + a normalized Nigerian number only;
// nothing is sent over WhatsApp until the Phase 3 lifecycle ships. Email
// remains the default channel either way, so declining costs the student
// nothing.
//
// Visibility rules: hidden once opted in, hidden for the session once
// dismissed (sessionStorage, so it can return tomorrow without nagging
// twice in one sitting), and never rendered server-side.
const DISMISS_KEY = "scholars:wa_banner_dismissed";
// Accepts 08031234567, +2348031234567, 2348031234567 and normalizes to
// E.164 (+234...). Returns null when the number isn't a valid Nigerian
// mobile format so we never store garbage consent targets.
export function normalizeNigerianNumber(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  let normalized = digits;
  if (digits.startsWith("0")) normalized = "+234" + digits.slice(1);
  else if (digits.startsWith("+234")) normalized = digits;
  else if (digits.startsWith("234")) normalized = "+" + digits;
  else return null;
  return /^\+234\d{10}$/.test(normalized) ? normalized : null;
}
export function WhatsappOptIn({ initialOptIn }: { initialOptIn: boolean }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (initialOptIn || hidden || done) return null;
  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage blocked: hide for this render only
    }
    setHidden(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeNigerianNumber(number);
    if (!normalized) {
      setError("Enter a Nigerian number like 08031234567 or +2348031234567.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp_opt_in: true, whatsapp_number: normalized }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't save that right now. Try again.");
      return;
    }
    track("whatsapp_opt_in");
    setDone(true);
  }
  return (
    <div className="bg-white rounded-xl border border-hairline shadow-card p-5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            Get deadline reminders on WhatsApp
          </p>
          <p className="text-xs text-navy-light mt-1 leading-relaxed">
            Email stays on either way. We&apos;ll only message you about deadlines and
            matches you asked for. No groups, no spam, opt out any time.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss WhatsApp reminders offer"
          className="shrink-0 text-navy-light hover:text-navy p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
        <label className="flex-1">
          <span className="sr-only">WhatsApp number</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-navy-light/50 focus:border-navy outline-none transition-colors"
            placeholder="08031234567"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {busy ? "Saving\u2026" : "Enable WhatsApp reminders"}
        </button>
      </form>
      <div className="mt-2">
        <StatusMessage tone="error">{error}</StatusMessage>
      </div>
    </div>
  );
}
