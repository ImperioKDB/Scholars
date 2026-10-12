"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { EmailBatchButtons } from "@/components/admin/EmailBatchButtons";
import { fetchWithTimeout } from "@/lib/fetch";
import type { EmailBatch } from "@/lib/email/batches";

type Pending = { batch: EmailBatch; force: boolean } | null;
export function SendProfileNudgesButton({ lastNudgeAt }: { lastNudgeAt: string | null }) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    if (!pending) return;
    const { batch, force } = pending;
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetchWithTimeout("/api/admin/profile-nudges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force, batch }), timeoutMs: force ? 240_000 : 120_000 });
      if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body.error ?? "Couldn't send the reminders. Try again."); return; }
      const { summary } = await res.json();
      const firstError = typeof summary.first_error === "string" ? summary.first_error : null;
      if (summary.skipped_missing_columns) setError("The reminder tracking columns don't exist yet. Run migration 0018_add_profile_reminder_tracking.sql in the Supabase SQL editor, then try again.");
      else if (summary.students_emailed === 0 && summary.failed > 0) setError(`Batch ${batch}: nothing went out. ${summary.failed} failure${summary.failed === 1 ? "" : "s"}.` + (firstError ? ` First error: ${firstError}` : ""));
      else if (summary.dry_run) setNotice(`Dry run for Batch ${batch}: ${summary.students_emailed} reminder(s) prepared but nothing was sent.`);
      else if (summary.students_emailed === 0) setNotice(`Batch ${batch}: nobody is currently eligible for a reminder.`);
      else setNotice(`Batch ${batch}: ${force ? "override sent" : "sent"} ${summary.students_emailed} profile reminder email${summary.students_emailed === 1 ? "" : "s"}.` + (summary.failed > 0 ? ` ${summary.failed} failed.` : ""));
      setPending(null);
    } catch { setError("Couldn't reach the server. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const lastLabel = lastNudgeAt ? new Date(lastNudgeAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return <div>
    {pending && <ConfirmDialog message={`${pending.force ? "Override the normal reminder guards and " : ""}send profile reminders to Batch ${pending.batch} only? This selects up to 300 students in the stable student order.`} onConfirm={send} onClose={() => !busy && setPending(null)} confirmLabel={`Send Batch ${pending.batch}`} tone={pending.force ? "rose" : "navy"} />}
    <div className="space-y-3">
      <div><p className="text-xs text-navy-light mb-2">Routine reminders</p><EmailBatchButtons onSelect={(batch) => setPending({ batch, force: false })} disabled={busy} /></div>
      <div><p className="text-xs text-navy-light mb-2">Override and send to all eligible profiles</p><EmailBatchButtons onSelect={(batch) => setPending({ batch, force: true })} disabled={busy} tone="rose" /></div>
      {lastLabel && <span className="text-xs text-navy-light">Last reminder activity: {lastLabel}</span>}
    </div>
    <div className="mt-3"><StatusMessage tone="success">{notice}</StatusMessage><StatusMessage tone="error">{error}</StatusMessage></div>
  </div>;
}
