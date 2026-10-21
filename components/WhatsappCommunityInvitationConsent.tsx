"use client";

import { useState } from "react";
import { normalizeNigerianNumber } from "@/lib/whatsapp/phone";

type Props = {
  initialOptIn: boolean;
  initialNumber: string | null;
};

export function WhatsappCommunityInvitationConsent({ initialOptIn, initialNumber }: Props) {
  const [optedIn, setOptedIn] = useState(initialOptIn);
  const [formOpen, setFormOpen] = useState(!initialOptIn);
  const [number, setNumber] = useState(initialNumber ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitGrant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!confirmed) {
      setError("Please tick the consent box before opting in.");
      return;
    }
    const normalized = normalizeNigerianNumber(number);
    if (!normalized) {
      setError("Enter a Nigerian number like 08031234567 or +2348031234567.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/profile/whatsapp-community-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", consented: true, whatsapp_number: normalized }),
      });
      if (!response.ok) {
        setError("We couldn't save your choice. Please try again.");
        return;
      }
      setNumber(normalized);
      setOptedIn(true);
      setFormOpen(false);
      setConfirmed(false);
      setMessage("Your consent is saved. A founder may send one invitation manually; no message has been sent.");
    } catch {
      setError("We couldn't save your choice. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const response = await fetch("/api/profile/whatsapp-community-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      if (!response.ok) {
        setError("We couldn't withdraw your consent. Please try again.");
        return;
      }
      setOptedIn(false);
      setFormOpen(true);
      setConfirmed(false);
      setMessage("Your invitation consent has been withdrawn. Do not send a community invitation.");
    } catch {
      setError("We couldn't withdraw your consent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const maskedNumber = number.replace(/\D/g, "").slice(-4);

  return (
    <div>
      <p className="text-sm text-navy-light leading-relaxed mb-4">
        This is separate from deadline-reminder preferences. If you opt in, a Scholars founder may manually send one WhatsApp invitation to join the Student Community. We will not send it automatically or add you to a group. You can withdraw consent here at any time before the invitation is sent.
      </p>

      {optedIn && !formOpen ? (
        <div className="rounded-xl border border-emerald/25 bg-emerald-light/40 p-4">
          <p className="text-sm font-semibold text-navy">You opted in to one community invitation.</p>
          <p className="mt-1 text-sm text-navy-light">
            WhatsApp number ending {maskedNumber ? `in ${maskedNumber}` : "not available"}. No invitation has been sent automatically.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setFormOpen(true); setConfirmed(false); setMessage(null); setError(null); }}
              disabled={busy}
              className="min-h-[44px] rounded-seal border border-hairline bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-navy-50 disabled:opacity-60"
            >
              Change number
            </button>
            <button
              type="button"
              onClick={withdraw}
              disabled={busy}
              className="min-h-[44px] rounded-seal border border-hairline bg-white px-4 py-2 text-sm font-medium text-navy-light hover:border-red-300 hover:text-red-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Withdraw consent"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submitGrant} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">WhatsApp number for this invitation</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={24}
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="08031234567"
              className="min-h-[44px] w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-navy-light/50 focus:border-navy"
            />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-hairline bg-parchment/70 p-3.5">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-navy"
            />
            <span className="text-sm leading-relaxed text-ink">
              I explicitly agree to receive one manually sent WhatsApp invitation to join the Scholars Student Community at this number. This does not subscribe me to scholarship reminders or other messages.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !confirmed}
              className="min-h-[44px] rounded-seal bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save invitation consent"}
            </button>
            {optedIn && (
              <button
                type="button"
                onClick={() => { setFormOpen(false); setConfirmed(false); setError(null); }}
                disabled={busy}
                className="min-h-[44px] rounded-seal border border-hairline bg-white px-4 py-2 text-sm font-medium text-navy-light disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" aria-live="polite" className="mt-3 text-sm text-emerald">{message}</p>}
    </div>
  );
}
