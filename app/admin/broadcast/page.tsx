"use client";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { DeadlineBadge } from "@/components/DeadlineBadge";

// app/admin/broadcast/page.tsx
//
// Hand-picked broadcast: tick the scholarships you want to push out, see
// exactly how many registered emails that will reach, confirm, send. One
// personalized email per recipient containing every selected scholarship
// as tiles -- never one email per scholarship.
//
// List is verified-only, most recent first (the admin list API already
// orders by created_at desc), so the newest research sits at the top where
// your thumb lands.
type Row = {
  id: string;
  title: string;
  provider_name: string;
  deadline: string | null;
  amount: string | null;
  verified: boolean;
  created_at: string;
};

export default function AdminBroadcastPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [listRes, countRes] = await Promise.all([
          fetch("/api/admin/scholarships"),
          fetch("/api/admin/broadcast"),
        ]);
        if (!listRes.ok) throw new Error("Couldn't load scholarships.");
        const { scholarships } = await listRes.json();
        setRows(((scholarships ?? []) as Row[]).filter((r) => r.verified));
        if (countRes.ok) {
          const { recipientCount: n } = await countRes.json();
          setRecipientCount(typeof n === "number" ? n : null);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Couldn't load the broadcast page.");
      }
      setLoading(false);
    }
    load();
  }, []);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedCount = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function send() {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scholarship_ids: [...selected] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't send the broadcast. Try again.");
        return;
      }
      setNotice(
        `Sent ${body.sent} email${body.sent === 1 ? "" : "s"} about ${body.scholarships} scholarship${body.scholarships === 1 ? "" : "s"} to ${body.recipients} registered email${body.recipients === 1 ? "" : "s"}.` +
          (body.failed > 0 ? ` ${body.failed} failed, check Vercel logs.` : "")
      );
      setSelected(new Set());
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  const sorted = useMemo(() => rows, [rows]);

  return (
    <div>
      {confirmOpen && (
        <ConfirmDialog
          message={`Send one email to ${recipientCount ?? "every"} registered email${recipientCount === 1 ? "" : "s"} about ${selectedCount} selected scholarship${selectedCount === 1 ? "" : "s"}? Each recipient gets a single email containing all selected scholarships.`}
          onConfirm={send}
          onClose={() => !sending && setConfirmOpen(false)}
          confirmLabel="Send broadcast"
          cancelLabel="Cancel"
          tone="navy"
        />
      )}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Broadcast</h1>
        <p className="text-sm text-navy-light mt-1">
          Hand-pick verified scholarships and email them to every registered student at once.
          Newest first. One email per student, never one per scholarship.
        </p>
      </div>

      {loadError && (
        <p className="text-sm text-rose mb-6" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <>
          <div className="bg-white rounded-xl border border-hairline p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded border-hairline"
              />
              Select all ({rows.length})
            </label>
            <p className="text-xs text-navy-light">
              {recipientCount !== null
                ? `Will send to ${recipientCount} registered email${recipientCount === 1 ? "" : "s"}`
                : "Recipient count unavailable"}
              {" · "}
              {selectedCount} selected
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="bg-white rounded-xl border border-hairline p-8 text-center">
              <p className="text-sm text-navy-light">
                No verified scholarships yet. Verify one in the Scholarships table first.
              </p>
            </div>
          ) : (
            <ul className="bg-white rounded-xl border border-hairline divide-y divide-hairline mb-6">
              {sorted.map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-navy-50/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="rounded border-hairline mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink leading-snug">{r.title}</p>
                      <p className="text-xs text-navy-light mt-0.5">{r.provider_name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <DeadlineBadge deadline={r.deadline} />
                        {r.amount && <span className="text-xs font-mono text-emerald">{r.amount}</span>}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <StatusMessage tone="success">{notice}</StatusMessage>
          <StatusMessage tone="error">{error}</StatusMessage>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={selectedCount === 0 || sending}
            className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {sending ? "Sending\u2026" : `Send to ${recipientCount ?? "all"} email${recipientCount === 1 ? "" : "s"}`}
          </button>
        </>
      )}
      {loading && <p className="text-sm text-navy-light">Loading&hellip;</p>}
    </div>
  );
}
