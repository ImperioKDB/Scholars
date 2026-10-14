"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { EmailBatchButtons } from "@/components/admin/EmailBatchButtons";
import { fetchWithTimeout } from "@/lib/fetch";
import type { EmailBatch } from "@/lib/email/batches";

export function SendDigestButton({ lastDigestAt }: { lastDigestAt: string | null }) {
  const [confirmBatch, setConfirmBatch] = useState<EmailBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    if (!confirmBatch) return;
    const batch = confirmBatch;
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetchWithTimeout("/api/admin/digest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch }), timeoutMs: 120_000 });
      if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body.error ?? "Couldn't send the digest. Try again."); return; }
      const { summary } = await res.json();
      if (summary.dry_run) setNotice(`Dry run for Batch ${batch}: ${summary.students_emailed} digest(s) prepared but nothing was sent.`);
      else if (summary.students_emailed === 0) setNotice(`Batch ${batch} has no new listings waiting for students.`);
      else setNotice(`Batch ${batch}: sent ${summary.students_emailed} digest email${summary.students_emailed === 1 ? "" : "s"} covering ${summary.listings_announced} listing${summary.listings_announced === 1 ? "" : "s"}.` + (summary.failed > 0 ? ` ${summary.failed} failed, check Vercel logs.` : ""));
      setConfirmBatch(null);
    } catch { setError("Couldn't reach the server. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const lastLabel = lastDigestAt ? new Date(lastDigestAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return <div>
    {confirmBatch && <ConfirmDialog message={`Send the latest new-listing email to Batch ${confirmBatch} only?`} onConfirm={send} onClose={() => !busy && setConfirmBatch(null)} confirmLabel={`Send Batch ${confirmBatch}`} />}
    <div className="flex flex-wrap items-center gap-3"><EmailBatchButtons onSelect={setConfirmBatch} disabled={busy} />{lastLabel && <span className="text-xs text-navy-light">Last digest activity: {lastLabel}</span>}</div>
    <div className="mt-3"><StatusMessage tone="success">{notice}</StatusMessage><StatusMessage tone="error">{error}</StatusMessage></div>
  </div>;
}
