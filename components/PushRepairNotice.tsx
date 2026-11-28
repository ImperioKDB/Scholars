"use client";

import { useEffect, useState } from "react";
import { enableBrowserPush, hasIncompatibleBrowserPush } from "@/lib/push/browser";

type Props = { profileId: string; publicKey: string };

export function PushRepairNotice({ profileId, publicKey }: Props) {
  const dismissalKey = `scholars:push:repair-dismissed:${profileId}:${publicKey}`;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(dismissalKey)) return;
    } catch {
      // A browser that blocks storage can still dismiss the current notice.
    }
    let active = true;
    void hasIncompatibleBrowserPush(publicKey)
      .then((incompatible) => { if (active && incompatible) setVisible(true); })
      .catch(() => { /* An unavailable check is not evidence of incompatibility. */ });
    return () => { active = false; };
  }, [dismissalKey, publicKey]);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(dismissalKey, "1");
    } catch {
      // The current notice is still dismissed.
    }
  }

  async function repair() {
    if (busy) return;
    if (Notification.permission !== "granted") {
      setMessage("Allow notifications in your browser’s site settings, then try again.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const result = await enableBrowserPush(publicKey, profileId);
      if (result === "granted") {
        setMessage("Push notifications are on for this device.");
        setFinished(true);
      } else if (result === "unverifiable") {
        setMessage("The subscription was saved. This browser does not report its key, so Scholars cannot verify that this device can receive alerts.");
        setFinished(true);
      } else {
        setMessage("Allow notifications in your browser’s site settings, then try again.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not repair notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <section aria-label="Push notification repair" className="mb-4 rounded-xl border border-hairline bg-white px-4 py-3 text-sm text-navy">
      {!finished && <p>This device’s push subscription uses an older key. Repair it to receive Scholars alerts.</p>}
      {message && <p role="status">{message}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {!finished && (
          <button type="button" disabled={busy} onClick={() => void repair()} className="font-semibold underline disabled:opacity-60">
            {busy ? "Repairing alerts…" : "Repair push notifications"}
          </button>
        )}
        <button type="button" disabled={busy} onClick={dismiss} className="text-navy-light underline disabled:opacity-60">
          Dismiss
        </button>
      </div>
    </section>
  );
}
