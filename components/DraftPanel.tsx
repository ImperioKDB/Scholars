"use client";

import { useState } from "react";

// components/DraftPanel.tsx
//
// Review-and-confirm UI for an auto-generated application draft. Lives
// inside a single application card in ApplicationsClient.tsx.
//
// This never submits anything anywhere -- "Confirm & use this draft" only
// timestamps that the student has reviewed it. The real next step is
// copying the statement + summary into the scholarship's own
// application_url, which is why that link sits right next to the confirm
// button rather than being buried elsewhere on the card.

export type Draft = {
  draft_statement: string | null;
  draft_summary: {
    facts: { label: string; value: string }[];
    checklist: { item: string; have: boolean }[];
  } | null;
  draft_generated_at: string | null;
  draft_confirmed_at: string | null;
};

export function DraftPanel({
  applicationId,
  draft,
  applicationUrl,
  onDraftChange,
}: {
  applicationId: string;
  draft: Draft;
  applicationUrl: string | null;
  onDraftChange: (draft: Draft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statement, setStatement] = useState(draft.draft_statement ?? "");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasDraft = Boolean(draft.draft_generated_at);
  const confirmed = Boolean(draft.draft_confirmed_at);
  const dirty = statement !== (draft.draft_statement ?? "");

  async function generate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/applications/${applicationId}/draft`, { method: "POST" });
    setGenerating(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't generate a draft. Try again.");
      return;
    }
    const { draft: updated } = await res.json();
    setStatement(updated.draft_statement ?? "");
    onDraftChange(updated);
    setOpen(true);
  }

  async function save(confirm: boolean) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/applications/${applicationId}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_statement: statement, confirm }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't save your changes.");
      return;
    }
    const { draft: updated } = await res.json();
    onDraftChange(updated);
  }

  async function copyAll() {
    const facts = draft.draft_summary?.facts.map((f) => `${f.label}: ${f.value}`).join("\n") ?? "";
    const text = `${statement}\n\n---\nApplication summary\n${facts}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!hasDraft) {
    return (
      <div className="mt-3 pt-3 border-t border-hairline">
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors disabled:opacity-50"
        >
          {generating ? "Drafting\u2026" : "Generate application draft"}
        </button>
        {error && <p className="text-xs text-rose mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-hairline">
      <div className="flex items-center justify-between gap-2 mb-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-navy hover:underline">
          {open ? "Hide draft" : "Review draft"}
        </button>
        <span
          className={
            "text-xs font-medium px-2 py-1 rounded-full " +
            (confirmed && !dirty ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber")
          }
        >
          {confirmed && !dirty ? "Confirmed" : "Needs review"}
        </span>
      </div>

      {open && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-ink mb-1.5">Personal statement</p>
            <textarea
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink resize-y min-h-[140px] focus:border-navy outline-none"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          </div>

          {draft.draft_summary && (
            <div>
              <p className="text-xs font-medium text-ink mb-1.5">Application summary</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-navy-50 rounded-lg p-3">
                {draft.draft_summary.facts.map((f) => (
                  <div key={f.label} className="contents">
                    <dt className="text-navy-light">{f.label}</dt>
                    <dd className="text-ink font-mono">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-2 space-y-1">
                {draft.draft_summary.checklist.map((c) => (
                  <li key={c.item} className="flex items-center gap-2 text-xs">
                    <span className={c.have ? "text-emerald" : "text-rose"}>{c.have ? "\u2713" : "\u2717"}</span>
                    <span className="text-navy-light">{c.item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-xs text-rose">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="text-xs font-medium text-white bg-emerald rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {confirmed && !dirty ? "Confirmed \u2713" : "Confirm & use this draft"}
            </button>
            {dirty && (
              <button
                type="button"
                onClick={() => save(false)}
                disabled={saving}
                className="text-xs font-medium text-navy-light hover:text-navy disabled:opacity-50"
              >
                Save edits
              </button>
            )}
            <button type="button" onClick={copyAll} className="text-xs font-medium text-navy-light hover:text-navy">
              {copied ? "Copied!" : "Copy statement + summary"}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="text-xs font-medium text-navy-light hover:text-navy disabled:opacity-50"
            >
              {generating ? "Regenerating\u2026" : "Regenerate"}
            </button>
            {applicationUrl && (
              <a
                href={applicationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-navy hover:underline ml-auto"
              >
                Open real application →
              </a>
            )}
          </div>

          <p className="text-[11px] text-navy-light">
            This draft isn&apos;t submitted anywhere. Review it, then copy it into the scholarship&apos;s own application
            page.
          </p>
        </div>
      )}
    </div>
  );
}
