"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithTimeout } from "@/lib/fetch";
import type { DiscussionCategory, ScholarshipDiscussion, ScholarshipSocialProof as ScholarshipSocialProofData } from "@/lib/scholarship-community";
import { ScholarshipSocialProof } from "@/components/ScholarshipSocialProof";

const CATEGORY_LABELS: Record<DiscussionCategory, string> = {
  question: "Question",
  answer: "Answer",
  experience: "Experience",
  update: "Update",
};

const CATEGORY_STYLES: Record<DiscussionCategory, string> = {
  question: "bg-navy-50 text-navy",
  answer: "bg-emerald-light text-emerald",
  experience: "bg-amber-light text-amber",
  update: "bg-rose-light text-rose",
};

type DiscussionFormState = {
  category: "question" | "experience" | "update" | "answer";
  title: string;
  body: string;
  is_anonymous: boolean;
  parent_id: string | null;
};

const emptyForm: DiscussionFormState = {
  category: "question",
  title: "",
  body: "",
  is_anonymous: true,
  parent_id: null,
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isDated(value: string) {
  return Date.now() - new Date(value).getTime() > 180 * 24 * 60 * 60 * 1000;
}

export function ScholarshipCommunity({
  scholarshipId,
  initialDiscussions,
  socialProof,
  canInteract,
}: {
  scholarshipId: string;
  initialDiscussions: ScholarshipDiscussion[];
  socialProof: ScholarshipSocialProofData;
  canInteract: boolean;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<"helpful" | "recent">("helpful");
  const [discussions, setDiscussions] = useState(initialDiscussions);
  const [form, setForm] = useState<DiscussionFormState>(emptyForm);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("misleading");
  const [reportDetails, setReportDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleTopLevel = useMemo(() => {
    const posts = discussions.filter((discussion) => !discussion.parent_id);
    return [...posts].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (sort === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (b.helpful_count !== a.helpful_count) return b.helpful_count - a.helpful_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [discussions, sort]);

  function repliesFor(parentId: string) {
    return discussions
      .filter((discussion) => discussion.parent_id === parentId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  function openComposer(parent?: ScholarshipDiscussion) {
    setError(null);
    setNotice(null);
    setForm({
      ...emptyForm,
      category: parent ? "answer" : "question",
      parent_id: parent?.id ?? null,
    });
    setComposerOpen(true);
  }

  async function submitPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canInteract) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchWithTimeout(`/api/scholarships/${scholarshipId}/community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          title: form.title.trim() || null,
          body: form.body.trim(),
          is_anonymous: form.is_anonymous,
          parent_id: form.parent_id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "We couldn't publish that post. Try again.");
        return;
      }
      setComposerOpen(false);
      setForm(emptyForm);
      setNotice("Posted. Thanks for helping other students.");
      router.refresh();
    } catch {
      setError("We couldn't reach Scholars. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function toggleHelpful(discussion: ScholarshipDiscussion) {
    if (!canInteract || activeReaction) return;
    setActiveReaction(discussion.id);
    setError(null);
    const nextHelpful = !discussion.user_helpful;
    setDiscussions((current) => current.map((item) => item.id === discussion.id ? {
      ...item,
      user_helpful: nextHelpful,
      helpful_count: Math.max(0, item.helpful_count + (nextHelpful ? 1 : -1)),
    } : item));
    try {
      const response = await fetchWithTimeout(`/api/discussions/${discussion.id}/helpful`, {
        method: nextHelpful ? "POST" : "DELETE",
      });
      if (!response.ok) throw new Error("reaction_failed");
    } catch {
      setDiscussions((current) => current.map((item) => item.id === discussion.id ? discussion : item));
      setError("We couldn't update that reaction. Try again.");
    } finally {
      setActiveReaction(null);
    }
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>, discussionId: string) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(`/api/discussions/${discussionId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "We couldn't send the report.");
        return;
      }
      setReportingId(null);
      setReportDetails("");
      setNotice("Thanks. Our team will review this discussion.");
    } catch {
      setError("We couldn't reach Scholars. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="community-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald">Community notes</p>
          <h2 id="community-title" className="mt-1 font-display text-2xl font-semibold text-navy">Questions, answers, and real experiences</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-light">
            Learn from students who have explored this award. Community posts are helpful context, not official scholarship guidance.
          </p>
        </div>
        {canInteract ? (
          <button type="button" onClick={() => openComposer()} className="rounded-seal bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-light">
            Start a discussion
          </button>
        ) : (
          <Link href="/login" className="rounded-seal border border-hairline bg-white px-4 py-2.5 text-center text-sm font-medium text-navy hover:border-navy/40">
            Log in to join
          </Link>
        )}
      </div>

      <ScholarshipSocialProof proof={socialProof} />

      {composerOpen && canInteract && (
        <form onSubmit={submitPost} className="mt-4 rounded-2xl border border-emerald/30 bg-white p-4 shadow-card sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-navy">{form.parent_id ? "Add an answer" : "Start a discussion"}</h3>
              <p className="mt-0.5 text-xs text-navy-light">Keep it specific, kind, and useful to the next student.</p>
            </div>
            <button type="button" onClick={() => setComposerOpen(false)} className="text-sm text-navy-light hover:text-navy">Cancel</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-navy">Post type</span>
              <select
                value={form.category}
                disabled={Boolean(form.parent_id) || pending}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as DiscussionFormState["category"] }))}
                className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink"
              >
                <option value="question">Question</option>
                <option value="experience">Experience</option>
                <option value="update">Update</option>
                {form.parent_id && <option value="answer">Answer</option>}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2.5 text-sm text-navy-light">
              <input type="checkbox" checked={form.is_anonymous} disabled={pending} onChange={(event) => setForm((current) => ({ ...current, is_anonymous: event.target.checked }))} className="h-4 w-4 accent-emerald" />
              Post anonymously
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-medium text-navy">Headline <span className="font-normal text-navy-light">(optional for answers)</span></span>
            <input value={form.title} disabled={pending} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={140} placeholder={form.parent_id ? "What are you answering?" : "e.g. Has anyone applied with a polytechnic transcript?"} className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink" />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-medium text-navy">Your note</span>
            <textarea required minLength={10} maxLength={2000} value={form.body} disabled={pending} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="Share what you know, what you tried, or what you need clarified." className="min-h-[130px] w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm leading-relaxed text-ink" />
          </label>
          {error && <p className="mt-3 text-sm text-rose" role="alert">{error}</p>}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-navy-light">Do not share phone numbers, passwords, or private documents.</p>
            <button type="submit" disabled={pending || form.body.trim().length < 10} className="rounded-seal bg-emerald px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald/90 disabled:opacity-60">{pending ? "Posting…" : "Publish post"}</button>
          </div>
        </form>
      )}

      {notice && <p className="mt-4 rounded-lg bg-emerald-light px-3 py-2.5 text-sm text-emerald" role="status">{notice}</p>}
      {error && !composerOpen && <p className="mt-4 rounded-lg bg-rose-light px-3 py-2.5 text-sm text-rose" role="alert">{error}</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-navy-light">{socialProof.discussion_count > 0 ? `${socialProof.discussion_count} community ${socialProof.discussion_count === 1 ? "post" : "posts"}` : "No community posts yet"}</p>
        <div className="flex rounded-lg border border-hairline bg-white p-1 text-xs">
          {(["helpful", "recent"] as const).map((option) => (
            <button key={option} type="button" onClick={() => setSort(option)} className={`rounded-md px-3 py-1.5 font-medium capitalize ${sort === option ? "bg-navy text-white" : "text-navy-light hover:text-navy"}`} aria-pressed={sort === option}>{option}</button>
          ))}
        </div>
      </div>

      {visibleTopLevel.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-hairline bg-white p-6 text-center">
          <p className="text-sm font-medium text-navy">Be the first to ask a useful question.</p>
          <p className="mt-1 text-xs leading-relaxed text-navy-light">Your experience can make this scholarship easier to understand for someone else.</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {visibleTopLevel.map((discussion) => (
            <DiscussionCard
              key={discussion.id}
              discussion={discussion}
              replies={repliesFor(discussion.id)}
              canInteract={canInteract}
              activeReaction={activeReaction}
              reportingId={reportingId}
              reportReason={reportReason}
              reportDetails={reportDetails}
              pending={pending}
              onHelpful={toggleHelpful}
              onReply={openComposer}
              onReport={setReportingId}
              onReportReason={setReportReason}
              onReportDetails={setReportDetails}
              onSubmitReport={submitReport}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DiscussionCard({
  discussion,
  replies,
  canInteract,
  activeReaction,
  reportingId,
  reportReason,
  reportDetails,
  pending,
  onHelpful,
  onReply,
  onReport,
  onReportReason,
  onReportDetails,
  onSubmitReport,
}: {
  discussion: ScholarshipDiscussion;
  replies: ScholarshipDiscussion[];
  canInteract: boolean;
  activeReaction: string | null;
  reportingId: string | null;
  reportReason: string;
  reportDetails: string;
  pending: boolean;
  onHelpful: (discussion: ScholarshipDiscussion) => void;
  onReply: (discussion?: ScholarshipDiscussion) => void;
  onReport: (id: string | null) => void;
  onReportReason: (reason: string) => void;
  onReportDetails: (details: string) => void;
  onSubmitReport: (event: React.FormEvent<HTMLFormElement>, id: string) => void;
}) {
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-card sm:p-5 ${discussion.is_pinned ? "border-emerald/40" : "border-hairline"}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 font-medium ${CATEGORY_STYLES[discussion.category]}`}>{CATEGORY_LABELS[discussion.category]}</span>
        {discussion.is_pinned && <span className="rounded-full bg-amber-light px-2.5 py-1 font-medium text-amber">Pinned by Scholars</span>}
        {discussion.is_verified_contributor && <span className="rounded-full bg-emerald-light px-2.5 py-1 font-medium text-emerald">Verified contributor</span>}
        {isDated(discussion.created_at) && <span className="text-navy-light">Older post · check details</span>}
      </div>
      {discussion.title && <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-navy">{discussion.title}</h3>}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{discussion.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-navy-light">
        <span>{discussion.author_label}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={discussion.created_at}>{formatDate(discussion.created_at)}</time>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
        <button type="button" disabled={!canInteract || activeReaction === discussion.id} onClick={() => onHelpful(discussion)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${discussion.user_helpful ? "border-emerald bg-emerald-light text-emerald" : "border-hairline text-navy-light hover:border-navy/40"}`} aria-pressed={discussion.user_helpful}>
          Helpful · {discussion.helpful_count}
        </button>
        {canInteract && <button type="button" onClick={() => onReply(discussion)} className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-navy-light hover:border-navy/40">Reply</button>}
        {canInteract && <button type="button" onClick={() => onReport(reportingId === discussion.id ? null : discussion.id)} className="rounded-full px-2 py-1.5 text-xs text-navy-light hover:text-navy">Report</button>}
      </div>
      {reportingId === discussion.id && (
        <form onSubmit={(event) => onSubmitReport(event, discussion.id)} className="mt-3 rounded-xl bg-parchment p-3">
          <label className="block text-xs font-medium text-navy">Why are you reporting this?</label>
          <select value={reportReason} onChange={(event) => onReportReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink">
            <option value="misleading">Misleading or inaccurate</option>
            <option value="abusive">Abusive or harassing</option>
            <option value="outdated">Outdated information</option>
            <option value="personal_information">Contains personal information</option>
            <option value="spam">Spam or promotional content</option>
          </select>
          <textarea value={reportDetails} onChange={(event) => onReportDetails(event.target.value)} maxLength={500} placeholder="Add context (optional)" className="mt-2 min-h-[80px] w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink" />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => onReport(null)} className="px-3 py-2 text-xs text-navy-light">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-navy px-3 py-2 text-xs font-medium text-white disabled:opacity-60">{pending ? "Sending…" : "Send report"}</button>
          </div>
        </form>
      )}
      {replies.length > 0 && (
        <div className="mt-4 grid gap-2 border-l-2 border-emerald/20 pl-3 sm:pl-4">
          {replies.map((reply) => (
            <div key={reply.id} className="rounded-xl bg-parchment/70 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-navy-light">
                <span className="rounded-full bg-emerald-light px-2 py-1 font-medium text-emerald">Answer</span>
                <span>{reply.author_label}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={reply.created_at}>{formatDate(reply.created_at)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{reply.body}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
