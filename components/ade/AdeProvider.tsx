
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
// ALWAYS VISIBLE as a small round avatar button, bottom-right -- this is
// the fix for Ade being invisible on pages with nothing to ask about.
// Tapping it toggles an expanded panel open/closed at any time. It opens
// itself automatically the moment a real prompt exists (a check-in
// question, or an apply-guard question), and shows a quiet dot badge if
// closed with something pending. With nothing pending, opening it shows a
// short idle message instead of nothing.
//
// Two ways a prompt appears:
//   1. Passive: on mount + on window focus, polls /api/mascot/next-prompt
//      for a pending check-in (clicked-but-unanswered, or
//      deadline-passed-still-in-progress).
//   2. Active: a page calls confirmApply() right before sending someone to
//      a provider's site for a scholarship they haven't tracked yet.
// Active always takes priority over passive.

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
  onTrack: () => void;
  onJustGo: () => void;
};

type AdePromptState = CheckinPrompt | ApplyGuardPrompt | null;

type ConfirmApplyArgs = {
  scholarshipTitle: string;
  alreadyTracked: boolean;
  onProceed: () => void;
  onTrackThenProceed: () => void;
};

type AdeContextValue = {
  confirmApply: (args: ConfirmApplyArgs) => void;
};

const AdeContext = createContext<AdeContextValue | null>(null);

export function useAde(): AdeContextValue {
  const ctx = useContext(AdeContext);
  if (!ctx) {
    // Pages outside an Ade-wrapped layout still work -- just no guard/nudge.
    return { confirmApply: ({ onProceed }) => onProceed() };
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
  const [activePrompt, setActivePrompt] = useState<ApplyGuardPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef(false);

  const pollNextPrompt = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await fetch("/api/mascot/next-prompt");
      if (res.ok) {
        const { prompt } = await res.json();
        if (prompt && !dismissedRef.current.has(prompt.applicationId)) {
          setPassivePrompt({ kind: "checkin", ...prompt });
          setOpen(true);
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

  const confirmApply = useCallback(
    ({ scholarshipTitle, alreadyTracked, onProceed, onTrackThenProceed }: ConfirmApplyArgs) => {
      if (alreadyTracked) {
        onProceed();
        return;
      }
      setActivePrompt({
        kind: "apply_guard",
        scholarshipTitle,
        onTrack: () => {
          setActivePrompt(null);
          onTrackThenProceed();
        },
        onJustGo: () => {
          setActivePrompt(null);
          onProceed();
        },
      });
      setOpen(true);
    },
    []
  );

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
                        onClick={prompt.onTrack}
                        className="text-xs font-medium text-white bg-emerald rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity"
                      >
                        Track it first
                      </button>
                      <button
                        type="button"
                        onClick={prompt.onJustGo}
                        className="text-xs font-medium text-navy-light hover:text-navy"
                      >
                        Just take me there
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
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close Ade" : "Open Ade"}
          className="relative w-14 h-14 rounded-full shadow-card border border-hairline bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
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
