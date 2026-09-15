"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

const REASONS = [
  ["deadline_wrong", "The deadline looks wrong"],
  ["broken_link", "The application link is broken"],
  ["closed", "This opportunity appears closed"],
  ["not_eligible", "The eligibility information is unclear"],
  ["other", "Something else"],
] as const;

export function ReportScholarshipButton({ scholarshipId }: { scholarshipId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("deadline_wrong");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    setState("sending");
    const res = await fetch("/api/scholarships/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scholarship_id: scholarshipId, reason, details }),
    }).catch(() => null);
    if (!res?.ok) { setState("error"); return; }
    track("button_clicked", { button_id: "scholarship_report_submitted", reason });
    setState("sent");
  }

  if (state === "sent") return <p className="text-xs text-emerald" role="status">Thanks — we&apos;ll review this listing.</p>;
  return (
    <div className="mt-5">
      <button type="button" onClick={() => { setOpen((v) => !v); track("button_clicked", { button_id: "scholarship_report_opened" }); }} className="text-xs text-navy-light hover:text-navy hover:underline">
        Report an issue with this listing
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-hairline bg-paper p-4 max-w-lg">
          <label className="block text-xs font-medium text-navy-light mb-1">What needs checking?</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm">
            {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2} placeholder="Optional details" className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm mt-2 resize-none" />
          <div className="flex items-center gap-3 mt-3">
            <button type="button" onClick={submit} disabled={state === "sending"} className="rounded-seal bg-navy text-white text-xs font-medium px-3 py-2 disabled:opacity-60">{state === "sending" ? "Sending…" : "Send report"}</button>
            {state === "error" && <span className="text-xs text-rose" role="alert">Couldn&apos;t send. Try again.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
