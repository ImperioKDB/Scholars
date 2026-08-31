"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// components/ade/AdeProvider.tsx
//
// Ade -- Scholars' persistent guide character (an owl; "Ade" reads as a
// real Nigerian name prefix meaning "crown," not a generic mascot name).
// One instance wraps each authenticated layout's children, so any page can
// trigger a prompt via useAde(), while a single floating bubble owns the
// UI so two prompts never stack on screen at once.
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
    },
    []
  );

  const prompt: AdePromptState = activePrompt ?? passivePrompt;

  return (
    <AdeContext.Provider value={{ confirmApply }}>
      {children}

      {prompt && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-[90]">
          <div className="bg-white rounded-2xl border border-hairline shadow-card p-4">
            <div className="flex items-start gap-3">
              <AdeAvatar />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-emerald mb-0.5">Ade</p>

                {prompt.kind === "apply_guard" ? (
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
                ) : (
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
            </div>
          </div>
        </div>
      )}
    </AdeContext.Provider>
  );
}
