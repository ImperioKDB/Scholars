"use client";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchWithTimeout } from "@/lib/fetch";
// components/admin/SendProfileNudgesButton.tsx
//
// The manual profile-reminder triggers on the admin overview. Two buttons,
// two intents:
//   - "Send profile reminders now": the routine pass. Same 2-day interval
//     and 5-email cap as the scheduled cron, so it only emails students
//     who are actually due.
//   - "Override and send to all": the one-off campaign pass. Ignores the
//     2-day wait AND the cap, emailing every profile under 100% right
//     now. Rose outline + its own confirm dialog that states exactly what
//     it overrides, so it can never be tapped by accident.
//
// HONEST FAILURE REPORTING (bug fix): zero sends used to render the same
// green "nobody to email" line whether the pass genuinely had no
// recipients or every Brevo call was rejected (unverified sender, bad
// key) or the recipient query threw. Now zero sends plus failures > 0
// renders as a red error quoting summary.first_error inline, so the real
// reason is visible on this page instead of only in Vercel Logs.
//
// Long timeout (240s on override) because the pass loops students
// sequentially; the route itself allows up to 300s.
export function SendProfileNudgesButton({ lastNudgeAt }: { lastNudgeAt: string | null }) {
const [confirmOpen, setConfirmOpen] = useState(false);
const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
const [busy, setBusy] = useState(false);
const [notice, setNotice] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);
async function send(force: boolean) {
setBusy(true);
setError(null);
setNotice(null);
try {
const res = await fetchWithTimeout("/api/admin/profile-nudges", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ force }),
timeoutMs: force ? 240_000 : 120_000,
});
if (!res.ok) {
const body = await res.json().catch(() => ({}));
setError(body.error ?? "Couldn't send the reminders. Try again.");
return;
}
const { summary } = await res.json();
const firstError = typeof summary.first_error === "string" ? summary.first_error : null;
if (summary.skipped_missing_columns) {
setError(
"The reminder tracking columns don't exist yet. Run migration 0018_add_profile_reminder_tracking.sql in the Supabase SQL editor, then try again."
);
} else if (summary.students_emailed === 0 && summary.failed > 0) {
// The pass ran and nothing landed. This is the branch the old UI
// was missing: it used to fall through to "nobody to email".
setError(
`Nothing went out: ${summary.failed} failure${summary.failed === 1 ? "" : "s"} before or during sending.` +
(firstError
? ` First error: ${firstError}`
: " Check Vercel Logs under email/profile-nudges.")
);
} else if (summary.dry_run) {
setNotice(
`Dry run: email is not configured on the server, so ${summary.students_emailed} reminder(s) were prepared but nothing was sent.`
);
} else if (summary.students_emailed === 0) {
setNotice(
force
? "No profile is under 100% right now, so there was nobody to email."
: "Nothing to send right now. Every student under 100% was either reminded within the last 2 days or has already reached the 5-email cap."
);
} else {
setNotice(
(force ? "Override send finished: sent " : "Sent ") +
`${summary.students_emailed} profile reminder email${summary.students_emailed === 1 ? "" : "s"}` +
(force ? ", ignoring wait time and cap." : ".") +
(summary.failed > 0
? ` ${summary.failed} failed${firstError ? `, first error: ${firstError}` : ", check Vercel Logs"}.`
: "")
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
onConfirm={() => send(false)}
onClose={() => !busy && setConfirmOpen(false)}
confirmLabel="Send reminders"
/>
)}
{forceConfirmOpen && (
<ConfirmDialog
message="Override the guards and email EVERY student under 100% right now? This ignores the 2-day wait and the 5-email cap, so students reminded recently (including by the scheduled job) get another email immediately. Use for one-off campaigns, not routine sends."
onConfirm={() => send(true)}
onClose={() => !busy && setForceConfirmOpen(false)}
confirmLabel="Send to everyone"
tone="rose"
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
<button
type="button"
onClick={() => setForceConfirmOpen(true)}
disabled={busy}
className="rounded-seal border border-rose/40 text-rose text-sm font-medium px-5 py-2.5 hover:bg-rose-light transition-colors disabled:opacity-60 whitespace-nowrap"
>
{busy ? "Sending\u2026" : "Override and send to all"}
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
