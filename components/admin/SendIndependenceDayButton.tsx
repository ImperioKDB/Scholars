"use client";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { EmailBatchButtons } from "@/components/admin/EmailBatchButtons";
import { fetchWithTimeout } from "@/lib/fetch";
import type { EmailBatch } from "@/lib/email/batches";

type CampaignStatus = { available: boolean; alreadySent: boolean; sent: number; recipientCount: number | null; pushRecipientCount: number | null; sentBatches?: Partial<Record<EmailBatch, boolean>> };
export function SendIndependenceDayButton() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [confirmBatch, setConfirmBatch] = useState<EmailBatch | null>(null);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  async function loadStatus() { try { const response = await fetch("/api/admin/independence-day"); if (!response.ok) throw new Error("Couldn't check campaign status."); setStatus(await response.json()); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't check campaign status."); } }
  useEffect(() => { void loadStatus(); }, []);
  async function send() {
    if (!confirmBatch) return; const batch = confirmBatch; setBusy(true); setError(null); setNotice(null);
    try { const response = await fetchWithTimeout("/api/admin/independence-day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch }), timeoutMs: 120_000 }); const body = await response.json().catch(() => ({})); if (!response.ok) { setError(body.error ?? "Couldn't send the Independence Day broadcast."); return; } const push = body.push ?? {}; setNotice(`Batch ${batch}: sent ${body.sent} Independence Day email${body.sent === 1 ? "" : "s"}; push was accepted for ${push.acceptedProfiles ?? 0} of ${push.recipients ?? 0} opted-in profiles.` + (body.failed > 0 ? ` ${body.failed} email${body.failed === 1 ? "" : "s"} failed.` : "")); setStatus((current) => current ? { ...current, sentBatches: { ...current.sentBatches, [batch]: true } } : current); setConfirmBatch(null); } catch { setError("Couldn't reach the server. Check your connection and try again."); } finally { setBusy(false); }
  }
  const unavailable = status !== null && !status.available;
  return <section className="bg-emerald-light/50 border border-emerald/20 rounded-xl p-4 mb-8">
    {confirmBatch && <ConfirmDialog message={`Send the Independence Day greeting by email and push to Batch ${confirmBatch} only? Push will also be limited to the same 300-student batch.`} onConfirm={send} onClose={() => !busy && setConfirmBatch(null)} confirmLabel={`Send Batch ${confirmBatch}`} cancelLabel="Cancel" tone="navy" />}
    <div className="flex flex-col gap-4"><div><h2 className="font-display text-lg font-semibold text-navy">Nigeria Independence Day</h2><p className="text-sm text-navy-light mt-1">Congratulate students with a short Scholars greeting.</p></div><EmailBatchButtons onSelect={setConfirmBatch} disabled={busy || status === null || unavailable} sentBatches={status?.sentBatches} tone="emerald" /></div>
    <StatusMessage tone="success">{notice}</StatusMessage><StatusMessage tone="error">{error}</StatusMessage>
    {unavailable && <p className="text-xs text-navy-light mt-2">Available on 1 October.</p>}
  </section>;
}
