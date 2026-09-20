"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";

export function SendTestProfileNudgeButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetchWithTimeout("/api/admin/test-profile-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "SEND_PROFILE_NUDGE_TEST" }),
        timeoutMs: 30_000,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "The test email could not be queued.");
        return;
      }
      setNotice(`Queued for ${body.recipient}. Delivery ID: ${body.deliveryId}`);
      setConfirmOpen(false);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {confirmOpen && (
        <ConfirmDialog
          message="Send one profile-nudge test email to talentedbeejay@gmail.com through Inngest? This is the only recipient allowed by this test action."
          onConfirm={send}
          onClose={() => !busy && setConfirmOpen(false)}
          confirmLabel="Send test email"
        />
      )}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="rounded-seal border border-emerald/40 text-emerald text-sm font-medium px-5 py-2.5 hover:bg-emerald-light transition-colors disabled:opacity-60"
      >
        {busy ? "Queueing test…" : "Send Inngest test email"}
      </button>
      <div className="mt-3">
        <StatusMessage tone="success">{notice}</StatusMessage>
        <StatusMessage tone="error">{error}</StatusMessage>
      </div>
    </div>
  );
}
