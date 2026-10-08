"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";
import { INDEPENDENCE_DAY_PUSH_MESSAGE } from "@/lib/push/broadcastContent";

type CampaignStatus = {
  available: boolean;
  alreadySent: boolean;
  sent: number;
  recipientCount: number | null;
  pushRecipientCount: number | null;
};

export function SendIndependenceDayButton() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const response = await fetch("/api/admin/independence-day");
      if (!response.ok) throw new Error("Couldn't check campaign status.");
      setStatus((await response.json()) as CampaignStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't check campaign status.");
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function send() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchWithTimeout("/api/admin/independence-day", {
        method: "POST",
        timeoutMs: 120_000,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Couldn't send the Independence Day broadcast.");
        return;
      }
      const push = body.push ?? {};
      setNotice(
        `Sent ${body.sent} Independence Day email${body.sent === 1 ? "" : "s"} to ${body.recipients} registered student${body.recipients === 1 ? "" : "s"}; push was accepted for ${push.acceptedProfiles ?? 0} of ${push.recipients ?? 0} opted-in profile${push.recipients === 1 ? "" : "s"}.` +
          (body.failed > 0 ? ` ${body.failed} email${body.failed === 1 ? "" : "s"} failed.` : "") +
          ((push.failedProfiles ?? 0) > 0 ? ` ${push.failedProfiles} push profile${push.failedProfiles === 1 ? "" : "s"} failed.` : "") +
          ((push.failedDevices ?? 0) > 0 ? ` ${push.failedDevices} push device${push.failedDevices === 1 ? "" : "s"} failed.` : "") +
          ((push.suppressedProfiles ?? 0) > 0 ? ` ${push.suppressedProfiles} profile${push.suppressedProfiles === 1 ? "" : "s"} had no active device at send time.` : "")
      );
      setStatus((current) => current ? { ...current, alreadySent: true, sent: body.sent } : current);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const recipientLabel = status?.recipientCount == null ? "registered students" : `${status.recipientCount} registered student${status.recipientCount === 1 ? "" : "s"}`;
  const pushRecipientLabel = status?.pushRecipientCount == null
    ? "all opted-in push profiles"
    : `${status.pushRecipientCount} opted-in push profile${status.pushRecipientCount === 1 ? "" : "s"}`;
  const unavailable = status !== null && !status.available;

  return (
    <section className="bg-emerald-light/50 border border-emerald/20 rounded-xl p-4 mb-8">
      {confirmOpen && (
        <ConfirmDialog
          message={`Send the Independence Day greeting by email to ${recipientLabel} and send a push alert to ${pushRecipientLabel}? Email recipients remain unchanged; push is limited to profiles with active push devices. Push preview: "${INDEPENDENCE_DAY_PUSH_MESSAGE.title}" — "${INDEPENDENCE_DAY_PUSH_MESSAGE.body}" Opens ${INDEPENDENCE_DAY_PUSH_MESSAGE.url}.`}
          onConfirm={send}
          onClose={() => !busy && setConfirmOpen(false)}
          confirmLabel="Send email + push"
          cancelLabel="Cancel"
          tone="navy"
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Nigeria Independence Day</h2>
          <p className="text-sm text-navy-light mt-1">Congratulate students with a short Scholars greeting.</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy || status === null || status.alreadySent || unavailable}
          className="rounded-seal bg-emerald text-white text-sm font-medium px-5 py-3 hover:bg-emerald/90 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {busy ? "Sending…" : status?.alreadySent ? "Greeting already sent" : unavailable ? "Available on 1 October" : "Send Independence Day email + push"}
        </button>
      </div>
      <StatusMessage tone="success">{notice}</StatusMessage>
      <StatusMessage tone="error">{error}</StatusMessage>
    </section>
  );
}
