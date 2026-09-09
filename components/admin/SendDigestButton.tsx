"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";

// components/admin/SendDigestButton.tsx
//
// The manual digest trigger on the admin overview. Confirms first because
// sending email is irreversible, then reports the server summary honestly:
// how many students were emailed and how many listings were announced, or
// why nothing went out (dry run, or everyone already up to date).
//
// Long timeout (120s) because the digest loops every student sequentially;
// the route itself allows up to 300s.
export function SendDigestButton({ lastDigestAt }: { lastDigestAt: string | null }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetchWithTimeout("/api/admin/digest", {
        method: "POST",
        timeoutMs: 120_000,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't send the digest. Try again.");
        return;
      }
      const { summary } = await res.json();
      if (summary.dry_run) {
        setNotice(
          `Dry run: email is not configured on the server, so ${summary.students_emailed} digest(s) were prepared but nothing was sent.`
        );
      } else if (summary.students_emailed === 0) {
        setNotice("Nothing new to announce. Every student is already up to date on the last 7 days of listings.");
      } else {
        setNotice(
          `Sent ${summary.students_emailed} digest email${summary.students_emailed === 1 ? "" : "s"} covering ${summary.listings_announced} listing${summary.listings_announced === 1 ? "" : "s"}.` +
            (summary.failed > 0 ? ` ${summary.failed} failed, check Vercel logs.` : "")
        );
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const lastLabel = lastDigestAt
    ? new Date(lastDigestAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div>
      {confirmOpen && (
        <ConfirmDialog
          message="Send the new-listing digest now? Each student gets ONE email bundling every verified listing from the last 7 days they haven't been told about yet. Students already up to date receive nothing."
          onConfirm={send}
          onClose={() => !busy && setConfirmOpen(false)}
          confirmLabel="Send digest"
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {busy ? "Sending\u2026" : "Send new-listing digest now"}
        </button>
        {lastLabel && (
          <span className="text-xs text-navy-light">Last digest activity: {lastLabel}</span>
        )}
      </div>
      <div className="mt-3">
        <StatusMessage tone="success">{notice}</StatusMessage>
        <StatusMessage tone="error">{error}</StatusMessage>
      </div>
    </div>
  );
}
