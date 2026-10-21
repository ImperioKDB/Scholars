"use client";

import { useState } from "react";

const MESSAGE =
  "Hi {first_name}, you opted in to receive one invitation to the Scholars Student Community. Join here: [COMMUNITY_INVITATION_LINK]. If you no longer want an invitation, you can withdraw your consent in your Scholars settings.";

export function CommunityInvitationMessage() {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(MESSAGE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-hairline bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-navy">Manual invitation message</h2>
      <p className="mt-1 text-sm text-navy-light">Copy and send manually to a consenting recipient. Scholars does not send or deliver WhatsApp messages.</p>
      <textarea
        aria-label="WhatsApp invitation message template"
        readOnly
        value={MESSAGE}
        rows={4}
        className="mt-4 w-full resize-y rounded-lg border border-hairline bg-parchment px-3 py-2.5 text-sm leading-relaxed text-ink"
      />
      <button
        type="button"
        onClick={copyMessage}
        className="mt-3 min-h-[44px] rounded-seal bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-light"
      >
        {copied ? "Copied" : "Copy message"}
      </button>
    </div>
  );
}
