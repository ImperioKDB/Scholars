"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithTimeout } from "@/lib/fetch";
import { Avatar } from "@/components/Avatar";
import { ContributorProfileSheet, type ContributorProfile } from "@/components/ContributorProfileSheet";
import type { DiscussionCategory, ScholarshipDiscussion, ScholarshipPrompt, ScholarshipSocialProof as ScholarshipSocialProofData } from "@/lib/scholarship-community";
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
  is_anonymous: false,
  parent_id: null,
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isDated(value: string) {
  return Date.now() - new Date(value).getTime() > 180 * 24 * 60 * 60 * 1000;
}

function promptLabel(prompt: ScholarshipPrompt) {
  if (prompt.prompt_key === "eligibility-check") return "Eligibility check";
  if (prompt.prompt_key === "application-experience") return "Your experience";
  if (prompt.prompt_key === "next-student-tip") return "A tip for others";
  return "Community prompt";
}

function promptDisplayText(prompt: ScholarshipPrompt) {
  if (prompt.prompt_key === "eligibility-check") return "Which requirement should applicants check first?";
  if (prompt.prompt_key === "application-experience") return "How did the application process go for you?";
  if (prompt.prompt_key === "next-student-tip") return "What do you wish you knew before applying?";
  return prompt.prompt_text.length > 110 ? `${prompt.prompt_text.slice(0, 107).trimEnd()}…` : prompt.prompt_text;
}

function promptCategory(prompt: ScholarshipPrompt): DiscussionFormState["category"] {
  if (prompt.prompt_key === "application-experience") return "experience";
  if (prompt.prompt_key === "next-student-tip") return "update";
  return "question";
}

function promptPlaceholder(prompt: ScholarshipPrompt) {
  if (prompt.prompt_key === "eligibility-check") return "Name the requirement and what students should confirm.";
  if (prompt.prompt_key === "application-experience") return "Share one step that was easy or difficult.";
  if (prompt.prompt_key === "next-student-tip") return "Share one practical thing you wish you knew.";
  return "Share a clear, helpful note for the next student.";
}

const ROLE_LABELS = {
  founder: "Founder",
  contributor: "Contributor",
  student: "Student",
} as const;

const ROLE_STYLES = {
  founder: "bg-amber-light text-amber",
  contributor: "bg-emerald-light text-emerald",
  student: "bg-navy-50 text-navy-light",
} as const;

export function ScholarshipCommunity({
  scholarshipId,
  initialDiscussions,
  prompts,
  socialProof,
  canInteract,
}: {
  scholarshipId: string;
  initialDiscussions: ScholarshipDiscussion[];
  prompts?: ScholarshipPrompt[];
  socialProof: ScholarshipSocialProofData;
  canInteract: boolean;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<"helpful" | "recent">("helpful");
  const [discussions, setDiscussions] = useState(initialDiscussions);
  const [form, setForm] = useState<DiscussionFormState>(emptyForm);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<ScholarshipPrompt | null>(null);
  const [pending, setPending] = useState(false);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("misleading");
  const [reportDetails, setReportDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contributorProfile, setContributorProfile] = useState<ContributorProfile | null>(null);
  const [contributorLoading, setContributorLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const composerRef = useRef<HTMLFormElement>(null);
  const officialPrompts = prompts ?? [];

  useEffect(() => {
    setHydrated(true);
  }, []);

  // router.refresh() updates the server-rendered props without remounting
  // this client component. Keep the visible list aligned with that refreshed
  // data so newly published posts appear without a full browser reload.
  useEffect(() => {
    setDiscussions(initialDiscussions);
  }, [initialDiscussions]);

  useEffect(() => {
    // Do not open a Supabase Realtime socket here. Some mobile browsers,
    // embedded webviews, and privacy networks reject the WebSocket handshake
    // with SecurityError/"operation is insecure", which used to turn a
    // non-essential live update into a route error. The initial server render
    // is authoritative; a lightweight visible-page poll keeps the discussion
    // list fresh without making the page depend on WebSocket support.
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const interval = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, scholarshipId]);

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

  function openComposer(parent?: ScholarshipDiscussion, prompt?: ScholarshipPrompt) {
    setError(null);
    setNotice(null);
    setSelectedPrompt(prompt ?? null);
    setForm({
      ...emptyForm,
      category: parent ? "answer" : prompt ? promptCategory(prompt) : "question",
      parent_id: parent?.id ?? null,
      body: "",
    });
    setComposerOpen(true);
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }

  async function openContributorProfile(discussion: ScholarshipDiscussion) {
    if (discussion.is_anonymous) return;
    setContributorProfile(null);
    setContributorLoading(true);
    try {
      const response = await fetch(`/api/community/contributors/${discussion.id}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.profile) setContributorProfile(payload.profile as ContributorProfile);
    } finally {
      setContributorLoading(false);
    }
  }

  function closeContributorProfile() {
    setContributorProfile(null);
    setContributorLoading(false);
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
      setSelectedPrompt(null);
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
          <h2 id="community-title" className="mt-1 font-display text-2xl font-semibold text-navy">Ask, share, and learn from students</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-light">
            Learn from students who have explored this award. Community posts are helpful context, not official scholarship guidance.
          </p>
        </div>
        {canInteract ? (
          <button type="button" onClick={() => openComposer()} className="w-full rounded-seal bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-light sm:w-auto">
            Share with students
          </button>
        ) : (
          <Link href="/login" className="rounded-seal border border-hairline bg-white px-4 py-2.5 text-center text-sm font-medium text-navy hover:border-navy/40">
            Log in to contribute
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-hairline rounded-2xl border border-hairline bg-white px-2 py-3 sm:max-w-xl sm:px-4" aria-label="Activity for this scholarship">
        <ActivityStat value={socialProof.discussion_post_count} label="discussions" />
        <ActivityStat value={socialProof.discussion_reply_count} label="replies" />
        <ActivityStat value={socialProof.discussion_contributor_count} label="contributors" />
      </div>

      {composerOpen && canInteract && (
        <form ref={composerRef} onSubmit={submitPost} className="mt-4 scroll-mt-6 rounded-2xl border border-emerald/30 bg-white p-4 shadow-card sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-navy">{form.parent_id ? "Add an answer" : selectedPrompt ? promptLabel(selectedPrompt) : "Add to the conversation"}</h3>
              <p className="mt-0.5 text-xs text-navy-light">One clear detail can help the next student.</p>
            </div>
            <button type="button" onClick={() => setComposerOpen(false)} className="text-sm text-navy-light hover:text-navy">Cancel</button>
          </div>
          {selectedPrompt && !form.parent_id && (
            <div className="mb-4 rounded-xl border border-emerald/20 bg-emerald-light/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald">{promptLabel(selectedPrompt)}</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-navy">{promptDisplayText(selectedPrompt)}</p>
            </div>
          )}
          {!form.parent_id && (
            <fieldset className="mb-3">
              <legend className="mb-1.5 text-xs font-medium text-navy">What are you sharing?</legend>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "question", label: "Ask a question" },
                  { value: "experience", label: "My experience" },
                  { value: "update", label: "A useful tip" },
                ] as const).map((option) => (
                  <button key={option.value} type="button" disabled={pending} aria-pressed={form.category === option.value} onClick={() => { setSelectedPrompt(null); setForm((current) => ({ ...current, category: option.value })); }} className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${form.category === option.value ? "border-emerald bg-emerald-light/50 text-emerald" : "border-hairline bg-white text-navy-light hover:border-emerald/40"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label className="mb-3 inline-flex items-center gap-2 text-xs text-navy-light"><input type="checkbox" checked={form.is_anonymous} disabled={pending} onChange={(event) => setForm((current) => ({ ...current, is_anonymous: event.target.checked }))} className="h-4 w-4 accent-emerald" />Post anonymously</label>
          <details className="mb-3 rounded-lg border border-hairline px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-navy-light">Add a headline (optional)</summary>
            <input value={form.title} disabled={pending} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={140} placeholder="A short title, if you want one" className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink" />
          </details>
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-navy">Your note</span><textarea required minLength={10} maxLength={2000} value={form.body} disabled={pending} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder={selectedPrompt ? promptPlaceholder(selectedPrompt) : form.parent_id ? "Share the answer you wish you’d had." : form.category === "question" ? "What would you like to know? Add a little context." : form.category === "experience" ? "What happened when you applied?" : "Share one practical thing students should know."} className="min-h-[130px] w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm leading-relaxed text-ink" /></label>
          {error && <p className="mt-3 text-sm text-rose" role="alert">{error}</p>}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-relaxed text-navy-light">Your post is public. Keep private details out.</p><button type="submit" disabled={pending || form.body.trim().length < 10} className="rounded-seal bg-emerald px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald/90 disabled:opacity-60">{pending ? "Posting…" : form.parent_id ? "Post answer" : form.category === "question" ? "Post question" : "Share note"}</button></div>
        </form>
      )}

      <ScholarshipSocialProof proof={socialProof} />

      {notice && <p className="mt-4 rounded-lg bg-emerald-light px-3 py-2.5 text-sm text-emerald" role="status">{notice}</p>}
      {error && !composerOpen && <p className="mt-4 rounded-lg bg-rose-light px-3 py-2.5 text-sm text-rose" role="alert">{error}</p>}

      {officialPrompts.length > 0 && (
        <div className="mt-6" aria-labelledby="community-prompts-title">
          <div className="mb-3">
            <h3 id="community-prompts-title" className="text-sm font-semibold text-navy">Quick ways to help</h3>
            <p className="mt-1 text-xs text-navy-light">Choose a starter. A few sentences are enough.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {officialPrompts.map((prompt) => (
              <article key={prompt.id} className="flex flex-col rounded-xl border border-hairline bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald">{promptLabel(prompt)}</p>
                <p className="mt-1 flex-1 text-sm font-medium leading-snug text-navy">{promptDisplayText(prompt)}</p>
                {canInteract ? (
                  <button type="button" disabled={pending} onClick={() => openComposer(undefined, prompt)} className="mt-3 min-h-10 rounded-lg bg-emerald-light/50 px-3 py-2 text-left text-xs font-semibold text-emerald transition-colors hover:bg-emerald-light focus:outline-none focus:ring-2 focus:ring-emerald/30 disabled:cursor-not-allowed disabled:opacity-60">
                    Write about this →
                  </button>
                ) : (
                  <Link href="/login" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-emerald-light/50 px-3 py-2 text-xs font-semibold text-emerald hover:bg-emerald-light">
                    Log in to contribute →
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <div><p className="text-sm font-medium text-navy">Recent conversations</p><p className="text-xs text-navy-light">{socialProof.discussion_post_count > 0 ? `${socialProof.discussion_post_count} ${socialProof.discussion_post_count === 1 ? "discussion" : "discussions"} about this scholarship` : "No discussions about this scholarship yet"}</p></div>
        <div className="flex rounded-lg border border-hairline bg-white p-1 text-xs">
          {(["helpful", "recent"] as const).map((option) => (
            <button key={option} type="button" onClick={() => setSort(option)} className={`rounded-md px-3 py-1.5 font-medium capitalize ${sort === option ? "bg-navy text-white" : "text-navy-light hover:text-navy"}`} aria-pressed={sort === option}>{option}</button>
          ))}
        </div>
      </div>

      {visibleTopLevel.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-hairline bg-white p-6 text-center">
          <p className="text-sm font-medium text-navy">No student discussions yet</p>
          <p className="mt-1 text-xs leading-relaxed text-navy-light">Be the first to share an experience or answer one of these conversation starters.</p>
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
              showOlderBadge={hydrated}
              onHelpful={toggleHelpful}
              onReply={openComposer}
              onReport={setReportingId}
              onReportReason={setReportReason}
              onReportDetails={setReportDetails}
              onSubmitReport={submitReport}
              onContributorClick={openContributorProfile}
            />
          ))}
        </div>
      )}

      <ContributorProfileSheet profile={contributorProfile} loading={contributorLoading} onClose={closeContributorProfile} />
    </section>
  );
}

function ActivityStat({ value, label }: { value: number; label: string }) {
  return <div className="px-2 text-center"><p className="font-display text-lg font-semibold text-navy">{value}</p><p className="text-[11px] text-navy-light">{label}</p></div>;
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
  showOlderBadge,
  onHelpful,
  onReply,
  onReport,
  onReportReason,
  onReportDetails,
  onSubmitReport,
  onContributorClick,
}: {
  discussion: ScholarshipDiscussion;
  replies: ScholarshipDiscussion[];
  canInteract: boolean;
  activeReaction: string | null;
  reportingId: string | null;
  reportReason: string;
  reportDetails: string;
  pending: boolean;
  showOlderBadge: boolean;
  onHelpful: (discussion: ScholarshipDiscussion) => void;
  onReply: (discussion?: ScholarshipDiscussion) => void;
  onReport: (id: string | null) => void;
  onReportReason: (reason: string) => void;
  onReportDetails: (details: string) => void;
  onSubmitReport: (event: React.FormEvent<HTMLFormElement>, id: string) => void;
  onContributorClick: (discussion: ScholarshipDiscussion) => void;
}) {
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-card sm:p-5 ${discussion.is_pinned ? "border-emerald/40" : "border-hairline"}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 font-medium ${CATEGORY_STYLES[discussion.category]}`}>{CATEGORY_LABELS[discussion.category]}</span>
        {discussion.is_pinned && <span className="rounded-full bg-amber-light px-2.5 py-1 font-medium text-amber">Pinned by Scholars</span>}
        {discussion.is_verified_contributor && <span className="rounded-full bg-emerald-light px-2.5 py-1 font-medium text-emerald">Verified contributor</span>}
        {showOlderBadge && isDated(discussion.created_at) && <span className="text-navy-light">Older post · check details</span>}
      </div>
      {discussion.title && <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-navy">{discussion.title}</h3>}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{discussion.body}</p>
      <div className="mt-4 flex items-center gap-3">
        {discussion.is_anonymous ? (
          <Avatar userId={discussion.id} fullName={discussion.author_name ?? discussion.author_label} avatarUrl={discussion.author_avatar_url} size="small" />
        ) : (
          <button type="button" onClick={() => onContributorClick(discussion)} aria-label={`View ${discussion.author_name ?? discussion.author_label}'s contributor profile`} className="rounded-full focus:outline-none focus:ring-2 focus:ring-emerald/40">
            <Avatar userId={discussion.id} fullName={discussion.author_name ?? discussion.author_label} avatarUrl={discussion.author_avatar_url} size="small" />
          </button>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-navy">
            {discussion.is_anonymous ? (
              <span>{discussion.author_name ?? discussion.author_label}</span>
            ) : (
              <button type="button" onClick={() => onContributorClick(discussion)} className="text-left underline decoration-navy/20 underline-offset-2 hover:text-emerald">
                {discussion.author_name ?? discussion.author_label}
              </button>
            )}
            {discussion.author_role && <span className={`rounded-full px-2 py-0.5 text-[10px] ${ROLE_STYLES[discussion.author_role]}`}>{ROLE_LABELS[discussion.author_role]}</span>}
            {discussion.author_is_online && <span className="inline-flex items-center gap-1 text-[10px] font-normal text-emerald"><span className="h-1.5 w-1.5 rounded-full bg-emerald" aria-hidden="true" />Online</span>}
          </div>
          <time dateTime={discussion.created_at} className="text-xs text-navy-light">{formatDate(discussion.created_at)}</time>
        </div>
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
              <div className="flex items-center gap-2.5">
                {reply.is_anonymous ? (
                  <Avatar userId={reply.id} fullName={reply.author_name ?? reply.author_label} avatarUrl={reply.author_avatar_url} size="small" />
                ) : (
                  <button type="button" onClick={() => onContributorClick(reply)} aria-label={`View ${reply.author_name ?? reply.author_label}'s contributor profile`} className="rounded-full focus:outline-none focus:ring-2 focus:ring-emerald/40">
                    <Avatar userId={reply.id} fullName={reply.author_name ?? reply.author_label} avatarUrl={reply.author_avatar_url} size="small" />
                  </button>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-navy">
                    {reply.is_anonymous ? (
                      <span>{reply.author_name ?? reply.author_label}</span>
                    ) : (
                      <button type="button" onClick={() => onContributorClick(reply)} className="text-left underline decoration-navy/20 underline-offset-2 hover:text-emerald">
                        {reply.author_name ?? reply.author_label}
                      </button>
                    )}
                    {reply.author_role && <span className={`rounded-full px-2 py-0.5 text-[10px] ${ROLE_STYLES[reply.author_role]}`}>{ROLE_LABELS[reply.author_role]}</span>}
                    {reply.author_is_online && <span className="inline-flex items-center gap-1 text-[10px] font-normal text-emerald"><span className="h-1.5 w-1.5 rounded-full bg-emerald" aria-hidden="true" />Online</span>}
                  </div>
                  <time dateTime={reply.created_at} className="text-[11px] text-navy-light">{formatDate(reply.created_at)}</time>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{reply.body}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
