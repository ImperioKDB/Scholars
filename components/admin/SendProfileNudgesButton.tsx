"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";
// components/admin/SendProfileNudgesButton.tsx
//
// The manual profile-reminder trigger on the admin overview. Mirrors
// SendDigestButton exactly: confirm first because sending email is
// irreversible, then report the server summary honestly -- how many
// students were emailed, or why nothing went out (dry run, everyone
// already reminded recently / at the cap, or the migration 0018 columns
// don't exist yet).
//
// Long timeout (120s) because the pass loops every eligible student
// sequentially; the route itself allows up to 300s.
export function SendProfileNudgesButton({ lastNudgeAt }: { lastNudgeAt: string | null }) {
const [confirmOpen, setConfirmOpen] = useState(false);
const [busy, setBusy] = useState(false);
const [notice, setNotice] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);
async function send() {
setBusy(true);
setError(null);
setNotice(null);
try {
const res = await fetchWithTimeout("/api/admin/profile-nudges", {
method: "POST",
timeoutMs: 120_000,
});
if (!res.ok) {
const body = await res.json().catch(() => ({}));
setError(body.error ?? "Couldn't send the reminders. Try again.");
return;
}
const { summary } = await res.json();
if (summary.skipped_missing_columns) {
setError(
"The reminder tracking columns don't exist yet. Run migration 0018_add_profile_reminder_tracking.sql in the Supabase SQL editor, then try again."
);
} else if (summary.dry_run) {
setNotice(
`Dry run: email is not configured on the server, so ${summary.students_emailed} reminder(s) were prepared but nothing was sent.`
);
} else if (summary.students_emailed === 0) {
setNotice(
"Nothing to send right now. Every student under 100% was either reminded within the last 2 days or has already reached the 5-email cap."
);
} else {
setNotice(
`Sent ${summary.students_emailed} profile reminder email${summary.students_emailed === 1 ? "" : "s"}.` +
(summary.failed > 0 ? ` ${summary.failed} failed, check Vercel logs.` : "")
);
}
} catch {
setError("Couldn't reach the server. Check your connection and try again.");
} finally {
setBusy(false);
}
}
const lastLabel = lastNudgeAt
? new Date(lastNudgeAt).toLocaleString("en-GB", {
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
message="Send profile completion reminders now? Every student whose profile is under 100% -- and who hasn't been reminded in the last 2 days and is under the 5-email cap -- gets ONE email naming the exact fields they're missing."
onConfirm={send}
onClose={() => !busy && setConfirmOpen(false)}
confirmLabel="Send reminders"
/>
)}
<div className="flex flex-wrap items-center gap-3">
<button
type="button"
onClick={() => setConfirmOpen(true)}
disabled={busy}
className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60 whitespace-nowrap"
>
{busy ? "Sending\u2026" : "Send profile reminders now"}
</button>
{lastLabel && (
<span className="text-xs text-navy-light">Last reminder activity: {lastLabel}</span>
)}
</div>
<div className="mt-3">
<StatusMessage tone="success">{notice}</StatusMessage>
<StatusMessage tone="error">{error}</StatusMessage>
</div>
</div>
);
}
