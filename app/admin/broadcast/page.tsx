"use client";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { SendIndependenceDayButton } from "@/components/admin/SendIndependenceDayButton";
import { buildListingBroadcastPushMessage } from "@/lib/push/broadcastContent";

// app/admin/broadcast/page.tsx
//
// Hand-picked broadcast: tick the scholarships and/or opportunities,
// review the registered-email and opted-in-push audiences, confirm, send.
// One email per recipient contains every selected listing as tiles --
// never one email per listing; push stays a separate opted-in channel.
//
// List is verified-only, most recent first (the admin list APIs already
// order by created_at desc), so the newest research sits at the top where
// your thumb lands.
type ScholarshipRow = {
  id: string;
  slug: string | null;
  title: string;
  provider_name: string;
  deadline: string | null;
  amount: string | null;
  verified: boolean;
  created_at: string;
};

type OpportunityRow = {
  id: string;
  slug: string | null;
  type: "fellowship" | "internship" | "competition" | "mentorship";
  title: string;
  provider_name: string;
  deadline: string | null;
  compensation: string | null;
  verified: boolean;
  created_at: string;
};

const TYPE_LABELS: Record<OpportunityRow["type"], string> = {
  fellowship: "Fellowship",
  internship: "Internship",
  competition: "Competition",
  mentorship: "Mentorship",
};

const TYPE_TONE: Record<OpportunityRow["type"], string> = {
  fellowship: "bg-navy-50 text-navy",
  internship: "bg-emerald-light text-emerald",
  competition: "bg-amber-light text-amber",
  mentorship: "bg-rose-light text-rose",
};

export default function AdminBroadcastPage() {
  const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedScholarships, setSelectedScholarships] = useState<Set<string>>(new Set());
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set());
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [pushRecipientCount, setPushRecipientCount] = useState<number | null>(null);
  const broadcastIdRef = useRef<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [schRes, oppRes, countRes] = await Promise.all([
          fetch("/api/admin/scholarships"),
          fetch("/api/admin/opportunities"),
          fetch("/api/admin/broadcast"),
        ]);
        if (!schRes.ok || !oppRes.ok) throw new Error("Couldn't load listings.");
        const { scholarships: sch } = await schRes.json();
        const { opportunities: opp } = await oppRes.json();
        setScholarships(((sch ?? []) as ScholarshipRow[]).filter((r) => r.verified));
        setOpportunities(((opp ?? []) as OpportunityRow[]).filter((r) => r.verified));
        if (countRes.ok) {
          const { recipientCount: n, pushRecipientCount: pushN } = await countRes.json();
          setRecipientCount(typeof n === "number" ? n : null);
          setPushRecipientCount(typeof pushN === "number" ? pushN : null);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Couldn't load the broadcast page.");
      }
      setLoading(false);
    }
    load();
  }, []);

  const totalSelected = selectedScholarships.size + selectedOpportunities.size;
  const selectedPushItems = [
    ...Array.from(selectedScholarships).flatMap((id) => {
      const row = scholarships.find((item) => item.id === id);
      return row ? [{ title: row.title, url: row.slug ? `/scholarship/${row.slug}` : "/discover" }] : [];
    }),
    ...Array.from(selectedOpportunities).flatMap((id) => {
      const row = opportunities.find((item) => item.id === id);
      return row ? [{ title: row.title, url: row.slug ? `/opportunity/${row.slug}` : "/discover" }] : [];
    }),
  ];
  const pushPreview = buildListingBroadcastPushMessage(selectedPushItems);

  function toggleScholarship(id: string) {
    broadcastIdRef.current = null;
    setSelectedScholarships((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleOpportunity(id: string) {
    broadcastIdRef.current = null;
    setSelectedOpportunities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const broadcastId = broadcastIdRef.current ?? window.crypto.randomUUID();
      broadcastIdRef.current = broadcastId;
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scholarship_ids: [...selectedScholarships],
          opportunity_ids: [...selectedOpportunities],
          broadcast_id: broadcastId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't send the broadcast. Try again.");
        return;
      }
      const push = body.push ?? {};
      setNotice(
        `Sent ${body.sent} of ${body.recipients} email${body.recipients === 1 ? "" : "s"} about ${body.listings} listing${body.listings === 1 ? "" : "s"}; push was accepted for ${push.acceptedProfiles ?? 0} of ${push.recipients ?? 0} opted-in profile${push.recipients === 1 ? "" : "s"}.` +
          (body.failed > 0 ? ` ${body.failed} email${body.failed === 1 ? "" : "s"} failed.` : "") +
          ((push.failedProfiles ?? 0) > 0 ? ` ${push.failedProfiles} push profile${push.failedProfiles === 1 ? "" : "s"} failed.` : "") +
          ((push.failedDevices ?? 0) > 0 ? ` ${push.failedDevices} push device${push.failedDevices === 1 ? "" : "s"} failed.` : "") +
          ((push.suppressedProfiles ?? 0) > 0 ? ` ${push.suppressedProfiles} profile${push.suppressedProfiles === 1 ? "" : "s"} had no active device at send time.` : "")
      );
      broadcastIdRef.current = null;
      setSelectedScholarships(new Set());
      setSelectedOpportunities(new Set());
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {confirmOpen && (
        <ConfirmDialog
          message={`Send one email to ${recipientCount ?? "every"} registered email${recipientCount === 1 ? "" : "s"} and a push alert to ${pushRecipientCount == null ? "all opted-in push profiles" : `${pushRecipientCount} opted-in push profile${pushRecipientCount === 1 ? "" : "s"}`} about ${totalSelected} selected listing${totalSelected === 1 ? "" : "s"}? Email recipients stay unchanged; push is limited to profiles with active push devices. Push preview: "${pushPreview.title}" — "${pushPreview.body}" Opens ${pushPreview.url}.`}
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
          Hand-pick verified scholarships and opportunities and email them to every registered student. Students with an active push subscription also receive a short push alert.
          Newest first. One email per student, never one per listing.
        </p>
      </div>

      <SendIndependenceDayButton />

      {loadError && (
        <StatusMessage tone="error" className="mb-6">
          {loadError}
        </StatusMessage>
      )}

      {!loading && !loadError && (
        <>
          <div className="bg-white rounded-xl border border-hairline p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-navy-light">
              {recipientCount !== null
                ? `${recipientCount} registered email${recipientCount === 1 ? "" : "s"}`
                : "Email recipient count unavailable"}
              {" · "}
              {pushRecipientCount !== null
                ? `${pushRecipientCount} opted-in push profile${pushRecipientCount === 1 ? "" : "s"}`
                : "Push recipient count unavailable"}
              {" · "}
              {totalSelected} selected ({selectedScholarships.size} scholarships, {selectedOpportunities.size} opportunities)
            </p>
          </div>

          {scholarships.length === 0 && opportunities.length === 0 ? (
            <div className="bg-white rounded-xl border border-hairline p-8 text-center">
              <p className="text-sm text-navy-light">
                No verified listings yet. Verify a scholarship or opportunity first.
              </p>
            </div>
          ) : (
            <>
              {scholarships.length > 0 && (
                <div className="mb-8">
                  <h2 className="font-display text-lg font-semibold text-navy mb-3">Scholarships</h2>
                  <ul className="bg-white rounded-xl border border-hairline divide-y divide-hairline">
                    {scholarships.map((r) => (
                      <li key={r.id}>
                        <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-navy-50/40 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedScholarships.has(r.id)}
                            disabled={sending}
                            onChange={() => toggleScholarship(r.id)}
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
                </div>
              )}

              {opportunities.length > 0 && (
                <div className="mb-8">
                  <h2 className="font-display text-lg font-semibold text-navy mb-3">Opportunities</h2>
                  <ul className="bg-white rounded-xl border border-hairline divide-y divide-hairline">
                    {opportunities.map((r) => (
                      <li key={r.id}>
                        <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-navy-50/40 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedOpportunities.has(r.id)}
                            disabled={sending}
                            onChange={() => toggleOpportunity(r.id)}
                            className="rounded border-hairline mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full mb-1 ${TYPE_TONE[r.type]}`}>
                              {TYPE_LABELS[r.type]}
                            </span>
                            <p className="text-sm font-medium text-ink leading-snug">{r.title}</p>
                            <p className="text-xs text-navy-light mt-0.5">{r.provider_name}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <DeadlineBadge deadline={r.deadline} />
                              {r.compensation && <span className="text-xs font-mono text-emerald">{r.compensation}</span>}
                            </div>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <StatusMessage tone="success">{notice}</StatusMessage>
          <StatusMessage tone="error">{error}</StatusMessage>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={totalSelected === 0 || sending}
            className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {sending ? "Sending\u2026" : `Send to ${recipientCount ?? "all"} emails + ${pushRecipientCount ?? "all opted-in"} push profiles`}
          </button>
        </>
      )}
      {loading && <p className="text-sm text-navy-light">Loading&hellip;</p>}
    </div>
  );
}
