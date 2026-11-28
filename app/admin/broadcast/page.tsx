"use client";
import { useEffect, useRef, useState } from "react";
import { BroadcastProgress } from "@/components/admin/BroadcastProgress";
import type { BroadcastOverview, BroadcastStatus } from "@/lib/broadcast/status";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ResendTestButton } from "@/components/admin/ResendTestButton";
import { BrevoTestButton } from "@/components/admin/BrevoTestButton";
import { SendIndependenceDayButton } from "@/components/admin/SendIndependenceDayButton";
import { EmailBatchButtons } from "@/components/admin/EmailBatchButtons";
import type { EmailBatch } from "@/lib/email/batches";
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
  type: "fellowship" | "internship" | "competition" | "mentorship" | "training";
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
  training: "Training",
};

const TYPE_TONE: Record<OpportunityRow["type"], string> = {
  fellowship: "bg-navy-50 text-navy",
  internship: "bg-emerald-light text-emerald",
  competition: "bg-amber-light text-amber",
  mentorship: "bg-rose-light text-rose",
  training: "bg-navy-50 text-navy",
};

const STORAGE_KEY = "scholars.admin.broadcast";

function readSubmission(): { id?: string; selection?: string; campaign?: string } {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function saveSubmission(submission: ReturnType<typeof readSubmission>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(submission));
  } catch {
    // The server can still identify an active campaign by its listing selection.
  }
}

export default function AdminBroadcastPage() {
  const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedScholarships, setSelectedScholarships] = useState<Set<string>>(new Set());
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set());
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [pushRecipientCount, setPushRecipientCount] = useState<number | null>(null);
  const submissionRef = useRef<{ id: string; selection: string } | null>(null);
  const submittingRef = useRef(false);
  const [recentCampaigns, setRecentCampaigns] = useState<BroadcastOverview["recent"]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [campaign, setCampaign] = useState<BroadcastStatus | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [confirmBatch, setConfirmBatch] = useState<EmailBatch | null>(null);
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
          const overview: BroadcastOverview = await countRes.json();
          setRecipientCount(overview.recipientCount);
          setPushRecipientCount(overview.pushRecipientCount);
          setRecentCampaigns(overview.recent);
          const saved = readSubmission();
          if (saved.id && saved.selection) submissionRef.current = { id: saved.id, selection: saved.selection };
          setCampaignId(saved.campaign || overview.recent[0]?.id || "");
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Couldn't load the broadcast page.");
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch("/api/admin/broadcast?id=" + encodeURIComponent(campaignId), {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Status unavailable");
        const status: BroadcastStatus = await response.json();
        if (controller.signal.aborted) return;
        setCampaign(status);
        setProgressError(null);
        setRecentCampaigns((previous) => {
          const recent = [status, ...previous.filter((entry) => entry.id !== status.id)]
            .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
          return recent.some((entry) => entry.id === status.id) ? recent : [...recent, status];
        });
        if (!status.completed_at) timer = setTimeout(refresh, 4000);
      } catch {
        if (controller.signal.aborted) return;
        setProgressError("Broadcast status is temporarily unavailable.");
        timer = setTimeout(refresh, 10000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [campaignId]);

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
    setSelectedScholarships((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleOpportunity(id: string) {
    setSelectedOpportunities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseBatch(batch: EmailBatch) {
    setConfirmBatch(batch);
  }
  async function send() {
    if (!confirmBatch || submittingRef.current) return;
    const batch = confirmBatch;
    const scholarship_ids = [...selectedScholarships];
    const opportunity_ids = [...selectedOpportunities];
    const selection = JSON.stringify({ batch, scholarship_ids, opportunity_ids });
    const previous = submissionRef.current;
    const id = previous?.selection === selection ? previous.id : window.crypto.randomUUID();
    submissionRef.current = { id, selection };
    saveSubmission({ id, selection, campaign: campaignId || undefined });
    submittingRef.current = true;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scholarship_ids, opportunity_ids, broadcast_id: id, batch }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't queue the broadcast. Retry to check the same submission.");
        return;
      }
      const status: BroadcastStatus = await res.json();
      setCampaign(status);
      setCampaignId(status.id);
      setProgressError(null);
      setNotice(status.completed_at
        ? "Broadcast progress restored."
        : "Broadcast queued. Processing can continue when you close this page.");
      setRecentCampaigns((previous) => [status, ...previous.filter((entry) => entry.id !== status.id)].slice(0, 10));
      saveSubmission({ campaign: status.id });
      submissionRef.current = null;
      setSelectedScholarships(new Set());
      setSelectedOpportunities(new Set());
      setConfirmBatch(null);
    } catch {
      setError("Submission status is unknown. Retry to check the same broadcast.");
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  }

  return (
    <div>
      {confirmBatch && (
        <ConfirmDialog
          message={`Queue the selected listings by email and push to Batch ${confirmBatch} only? This is up to 300 students in the stable student order. Push preview: "${pushPreview.title}" — "${pushPreview.body}" Opens ${pushPreview.url}.`}
          onConfirm={send}
          onClose={() => !sending && setConfirmBatch(null)}
          confirmLabel={`Queue Batch ${confirmBatch}`}
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

      <ResendTestButton />

      <BrevoTestButton />

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

          {recentCampaigns.length > 0 && (
            <div className="my-6 rounded-xl border border-hairline bg-white p-4">
              <label htmlFor="broadcast-campaign" className="text-sm font-medium text-navy">Recent broadcasts</label>
              <select
                id="broadcast-campaign"
                className="mb-3 ml-2 rounded border border-hairline p-1 text-sm"
                value={campaignId}
                onChange={(event) => {
                  const id = event.target.value;
                  setCampaignId(id);
                  setProgressError(null);
                  saveSubmission({ ...readSubmission(), campaign: id });
                }}
              >
                {recentCampaigns.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.batch ? `Batch ${entry.batch}` : "All recipients"} · {new Date(entry.created_at).toLocaleString()}
                  </option>
                ))}
              </select>
              {campaign?.id === campaignId && <BroadcastProgress campaign={campaign} />}
              {progressError && <StatusMessage tone="error">{progressError}</StatusMessage>}
            </div>
          )}
          <StatusMessage tone="success">{notice}</StatusMessage>
          <StatusMessage tone="error">{error}</StatusMessage>

          <EmailBatchButtons onSelect={chooseBatch} disabled={totalSelected === 0 || sending} />
        </>
      )}
      {loading && <p className="text-sm text-navy-light">Loading&hellip;</p>}
    </div>
  );
}
