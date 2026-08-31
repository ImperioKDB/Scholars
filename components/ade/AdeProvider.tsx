
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// components/ade/AdeProvider.tsx
//
// Ade -- Scholars' persistent guide character (an owl; "Ade" reads as a
// real Nigerian name prefix meaning "crown," not a generic mascot name).
// One instance wraps each authenticated layout's children, so any page can
// trigger a prompt via useAde(), while a single floating avatar owns the
// UI so two prompts never stack on screen at once.
//
// ALWAYS VISIBLE as a small round avatar button, bottom-right. Tapping it
// toggles an expanded panel open/closed at any time.
//
// ATTENTION SHAKE: when a genuinely new passive check-in prompt shows up
// (not a repeat poll hit for a prompt already surfaced), the avatar plays
// a brief rotation shake (see .ade-attention in app/globals.css) and, on
// browsers that support it, fires navigator.vibrate(). vibrate() is
// Android-Chrome-only and frequently gated behind an active user gesture
// by the browser itself -- it's a best-effort bonus, never the mechanism
// users actually rely on. The shake is. lastSeenPromptIdRef gates this so
// re-polling the same unanswered prompt doesn't re-shake every interval.
// Note this ref resets on remount, and AdeProvider remounts per
// authenticated layout (dashboard/applications/scholarships each have
// their own instance) -- a user bouncing between sections can see one
// re-shake for a prompt they'd already seen elsewhere. Acceptable for now;
// fix is persisting seen ids to localStorage if it becomes annoying.
//
// AUTO-OPEN RULES (deliberately asymmetric):
//   - Passive check-in prompts (from polling /api/mascot/next-prompt) do
//     NOT auto-open the panel -- they only light up the badge dot (and now
//     the attention shake). These arrive unprompted and can land while the
//     user is mid-read on a page (e.g. the eligibility requirements list),
//     so popping over content uninvited is a dialog-level interruption for
//     something that should behave like a dismissible banner. A tap opens
//     it.
//   - The apply-guard prompt (from confirmApply, fired the instant the
//     user clicks "Apply on provider's site") DOES auto-open -- it's a
//     direct response to something the user just did, not an ambient
//     interruption, so showing it immediately is expected here.
//
// TRACK-THEN-OPEN FLOW (fixes the about:blank bug): the old approach
// opened a blank tab synchronously, then tried to set its location after
// an awaited tracking request finished -- mobile Chrome doesn't reliably
// allow that deferred redirect, leaving a dead about:blank tab. The fix:
// never pre-open a tab. Track first (shown as a loading state in the
// panel), then render a fresh "Continue to application" button. Opening
// the real tab happens on that brand-new, fully synchronous click -- no
// popup blocker can intervene because there's no await between the click
// and the window.open call.

type CheckinReason = "clicked" | "deadline_passed";

type CheckinPrompt = {
  kind: "checkin";
  applicationId: string;
  scholarshipTitle: string;
  reason: CheckinReason;
};

type ApplyGuardPrompt = {
  kind: "apply_guard";
  scholarshipTitle: string;
  applicationUrl: string;
  onTrack: () => Promise<{ id: string } | null>;
};

type ReadyToOpenPrompt = {
  kind: "ready_to_open";
  scholarshipTitle: string;
  applicationUrl: string;
  applicationId: string;
};

type ActivePrompt = ApplyGuardPrompt | ReadyToOpenPrompt;
type AdePromptState = ActivePrompt | CheckinPrompt | null;

type ConfirmApplyArgs = {
  scholarshipTitle: string;
  applicationUrl: string;
  alreadyTracked: boolean;
  applicationId?: string;
  onTrack: () => Promise<{ id: string } | null>;
};

type AdeContextValue = {
  confirmApply: (args: ConfirmApplyArgs) => void;
};

const AdeContext = createContext<AdeContextValue | null>(null);

export function useAde(): AdeContextValue {
  const ctx = useContext(AdeContext);
  if (!ctx) {
    // Pages outside an Ade-wrapped layout still work -- just no guard/nudge,
    // straight through to the provider's site.
    return {
      confirmApply: (args) => {
        window.open(args.applicationUrl, "_blank", "noreferrer");
      },
    };
  }
  return ctx;
}

const STATUS_OPTIONS: { value: "submitted" | "in_progress" | "rejected"; label: string }[] = [
  { value: "submitted", label: "I applied" },
  { value: "in_progress", label: "Still working on it" },
  { value: "rejected", label: "Changed my mind" },
];

function AdeAvatar({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <circle cx="20" cy="20" r="20" fill="#1B8A6B" />
      <ellipse cx="14.5" cy="19" rx="5" ry="6" fill="#F7F5EF" />
      <ellipse cx="25.5" cy="19" rx="5" ry="6" fill="#F7F5EF" />
      <circle cx="14.5" cy="19.5" r="2.2" fill="#0B1E3D" />
      <circle cx="25.5" cy="19.5" r="2.2" fill="#0B1E3D" />
      <path d="M20 21.5l-2.3 3.5h4.6L20 21.5Z" fill="#C98A2E" />
      <path d="M11 12.5 15 16M29 12.5 25 16" stroke="#F7F5EF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AdeProvider({ children }: { children: React.ReactNode }) {
  const [passivePrompt, setPassivePrompt] = useState<CheckinPrompt | null>(null);
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackingInFlight, setTrackingInFlight] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef(false);
  const lastSeenPromptIdRef = useRef<string | null>(null);
  const [attention, setAttention] = useState(false);
  const attentionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollNextPrompt = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await fetch("/api/mascot/next-prompt");
      if (res.ok) {
        const { prompt } = await res.json();
        if (prompt && !dismissedRef.current.has(prompt.applicationId)) {
          // Deliberately does NOT setOpen(true) -- see AUTO-OPEN RULES above.
          setPassivePrompt({ kind: "checkin", ...prompt });

          if (lastSeenPromptIdRef.current !== prompt.applicationId) {
            lastSeenPromptIdRef.current = prompt.applicationId;
            setAttention(true);
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              // Best-effort only -- see file header note.
              navigator.vibrate([120, 60, 120]);
            }
            if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
            attentionTimeoutRef.current = setTimeout(() => setAttention(false), 2000);
          }
        }
      }
    } catch {
      // Silent -- Ade is a nice-to-have, never worth surfacing a network error for.
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    pollNextPrompt();
    function onFocus() {
      pollNextPrompt();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pollNextPrompt]);

  useEffect(() => {
    return () => {
      if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
    };
  }, []);

  async function answerCheckin(applicationId: string, status: "submitted" | "in_progress" | "rejected") {
    setSubmitting(true);
    await fetch(`/api/applications/${applicationId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", status }),
    }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(applicationId);
    setPassivePrompt(null);
  }

  async function snoozeCheckin(applicationId: string) {
    setSubmitting(true);
    await fetch(`/api/applications/${applicationId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snooze" }),
    }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(applicationId);
    setPassivePrompt(null);
  }

  async function markNotOpenYet(applicationId: string) {
    setSubmitting(true);
    await fetch(`/api/applications/${applicationId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "not_open_yet" }),
    }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(applicationId);
    setPassivePrompt(null);
  }

  const confirmApply = useCallback((args: ConfirmApplyArgs) => {
    if (args.alreadyTracked) {
      // Already tracked: nothing to ask, just record the click and go --
      // this stays fully synchronous inside the caller's click handler.
      if (args.applicationId) {
        fetch(`/api/applications/${args.applicationId}/click`, { method: "POST" }).catch(() => {});
      }
      window.open(args.applicationUrl, "_blank", "noreferrer");
      return;
    }

    setTrackError(null);
    setActivePrompt({
      kind: "apply_guard",
      scholarshipTitle: args.scholarshipTitle,
      applicationUrl: args.applicationUrl,
      onTrack: args.onTrack,
    });
    setOpen(true);
  }, []);

  async function handleTrackFirst() {
    if (!activePrompt || activePrompt.kind !== "apply_guard") return;
    setTrackError(null);
    setTrackingInFlight(true);
    const result = await activePrompt.onTrack();
    setTrackingInFlight(false);

    if (result?.id) {
      setActivePrompt({
        kind: "ready_to_open",
        scholarshipTitle: activePrompt.scholarshipTitle,
        applicationUrl: activePrompt.applicationUrl,
        applicationId: result.id,
      });
    } else {
      setTrackError("Couldn't track it just now -- you can still continue without tracking.");
    }
  }

  function handleJustGo() {
    if (!activePrompt || activePrompt.kind !== "apply_guard") return;
    window.open(activePrompt.applicationUrl, "_blank", "noreferrer");
    setActivePrompt(null);
  }

  function handleContinueToApplication() {
    if (!activePrompt || activePrompt.kind !== "ready_to_open") return;
    fetch(`/api/applications/${activePrompt.applicationId}/click`, { method: "POST" }).catch(() => {});
    // Fresh, fully synchronous click -- no await before this line, so no
    // popup blocker gets a chance to intervene.
    window.open(activePrompt.applicationUrl, "_blank", "noreferrer");
    setActivePrompt(null);
    setOpen(false);
  }

  const prompt: AdePromptState = activePrompt ?? passivePrompt;
  const hasPending = Boolean(prompt);

  return (
    <AdeContext.Provider value={{ confirmApply }}>
      {children}

      <div className="fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-2">
        {open && (
          <div className="w-[calc(100vw-2rem)] max-w-80 bg-white rounded-2xl border border-hairline shadow-card p-4">
            <div className="flex items-start gap-3">
              <AdeAvatar />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-emerald mb-0.5">Ade</p>

                {!prompt && (
                  <p className="text-sm text-ink leading-snug">
                    Hi, I&apos;m Ade! I&apos;ll remind you to track a scholarship before you head to a
                    provider&apos;s site, and check in with you after deadlines pass. Nothing to ask about
                    right now -- you&apos;re all caught up.
                  </p>
                )}

                {prompt?.kind === "apply_guard" && (
                  <>
                    <p className="text-sm text-ink leading-snug">
                      Want me to track <span className="font-medium">{prompt.scholarshipTitle}</span> before you
                      head over? I&apos;ll follow up so it doesn&apos;t fall through the cracks.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={handleTrackFirst}
                        disabled={trackingInFlight}
                        className="text-xs font-medium text-white bg-emerald rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {trackingInFlight ? "Tracking\u2026" : "Track it first"}
                      </button>
                      <button
                        type="button"
                        onClick={handleJustGo}
                        disabled={trackingInFlight}
                        className="text-xs font-medium text-navy-light hover:text-navy disabled:opacity-50"
                      >
                        Just take me there
                      </button>
                    </div>
                    {trackError && <p className="text-xs text-rose mt-2">{trackError}</p>}
                  </>
                )}

                {prompt?.kind === "ready_to_open" && (
                  <>
                    <p className="text-sm text-ink leading-snug">
                      You&apos;re tracking <span className="font-medium">{prompt.scholarshipTitle}</span> now
                      \u2713. Tap below when you&apos;re ready to head to the application.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={handleContinueToApplication}
                        className="text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors"
                      >
                        Continue to application &rarr;
                      </button>
                    </div>
                  </>
                )}

                {prompt?.kind === "checkin" && (
                  <>
                    <p className="text-sm text-ink leading-snug">
                      {prompt.reason === "clicked" ? (
                        <>
                          How did it go with <span className="font-medium">{prompt.scholarshipTitle}</span>?
                          Answering helps me match you better next time.
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{prompt.scholarshipTitle}</span>&apos;s deadline has
                          passed -- did you hear back?
                        </>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={submitting}
                          onClick={() => answerCheckin(prompt.applicationId, opt.value)}
                          className="text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors disabled:opacity-50"
                        >
                          {opt.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => markNotOpenYet(prompt.applicationId)}
                        className="text-xs font-medium text-navy-light border border-hairline rounded-full px-3 py-1.5 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-50"
                      >
                        Portal not open yet
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => snoozeCheckin(prompt.applicationId)}
                      className="text-xs text-navy-light hover:text-navy mt-2 disabled:opacity-50"
                    >
                      Ask me later
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 text-navy-light hover:text-navy -mt-1 -mr-1 p-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setAttention(false);
          }}
          aria-label={open ? "Close Ade" : "Open Ade"}
          className={[
            "relative w-14 h-14 rounded-full shadow-card border border-hairline bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform",
            attention ? "ade-attention" : "",
          ].join(" ")}
        >
          <AdeAvatar size={40} />
          {hasPending && !open && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose border-2 border-white" />
          )}
        </button>
      </div>
    </AdeContext.Provider>
  );
}
