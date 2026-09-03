"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Confetti } from "@/components/Confetti";

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
// THREE PROMPT KINDS now share the same floating panel:
//   - apply_guard / ready_to_open -- the "track before you go" flow,
//     client-driven via confirmApply(), auto-opens the panel (see
//     AUTO-OPEN RULES below).
//   - checkin -- passive, from polling /api/mascot/next-prompt. Does NOT
//     auto-open.
//   - achievement -- also passive, same polling endpoint, same
//     non-auto-opening treatment. Unlock moments speak in the same voice
//     as everything else Ade already says.
//
// ACHIEVEMENT CELEBRATION: the first time the panel is opened while an
// achievement prompt is showing, a tier-colored confetti burst fires and
// the panel content gets a spring "pop" entrance (see .badge-pop-in in
// app/globals.css). confettiShownRef dedupes by achievementId so
// re-opening the panel later (or the same achievement resurfacing across
// an AdeProvider remount) doesn't re-fire the burst. Deliberately NOT
// fired ambiently while the panel is closed -- that would be an
// interruption, which contradicts the deliberate non-auto-opening
// treatment passive prompts already get (see AUTO-OPEN RULES below).
//
// ATTENTION SHAKE: when a genuinely new passive prompt (checkin OR
// achievement) shows up, the avatar plays a brief rotation shake (see
// .ade-attention in app/globals.css) and, where supported,
// navigator.vibrate(). lastSeenPromptIdRef is now keyed by a prefixed id
// ("chk:<applicationId>" or "ach:<achievementId>") so the two kinds don't
// collide in the same ref. Resets on remount, same caveat as before:
// AdeProvider remounts per authenticated layout, so bouncing between
// sections can re-shake a prompt already seen elsewhere. Acceptable for
// now; fix is persisting seen ids to localStorage if it becomes annoying.
//
// AUTO-OPEN RULES (deliberately asymmetric):
//   - Passive prompts (checkin AND achievement) do NOT auto-open the
//     panel -- they only light up the badge dot and the attention shake.
//     A tap opens it.
//   - The apply-guard prompt DOES auto-open -- it's a direct response to
//     something the user just did, not an ambient interruption.
//
// TRACK-THEN-OPEN FLOW: unchanged from the original -- track first (shown
// as a loading state in the panel), then render a fresh "Continue to
// application" button so the real tab opens on a brand-new, fully
// synchronous click with no popup blocker able to intervene.

type CheckinReason = "clicked" | "deadline_passed";

type CheckinPrompt = {
  kind: "checkin";
  applicationId: string;
  scholarshipTitle: string;
  reason: CheckinReason;
};

type AchievementPrompt = {
  kind: "achievement";
  achievementId: string;
  label: string;
  description: string;
  xpReward: number;
  tier: string;
};

type PassivePrompt = CheckinPrompt | AchievementPrompt;

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
type AdePromptState = ActivePrompt | PassivePrompt | null;

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

// Tier -> confetti palette. Deliberately reuses the app's existing brand
// colors (navy/emerald/amber/parchment) rather than inventing literal
// bronze/silver/gold hex values -- gold leans on emerald, the color this
// app already treats as its top tier elsewhere (MatchSeal, achievement
// chips). Falls back to Confetti's own default palette for an unknown
// tier string.
const TIER_CONFETTI_COLORS: Record<string, string[]> = {
  bronze: ["#C98A2E", "#0B1E3D", "#F7F5EF"],
  silver: ["#8B93A3", "#0B1E3D", "#F7F5EF"],
  gold: ["#1B8A6B", "#C98A2E", "#0B1E3D"],
};

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
  const [passivePrompt, setPassivePrompt] = useState<PassivePrompt | null>(null);
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

  // Achievement-unlock celebration state -- see the ACHIEVEMENT
  // CELEBRATION note above the type definitions for why this fires on
  // open() rather than the moment the poll first sees the prompt.
  const confettiShownRef = useRef<Set<string>>(new Set());
  const [confettiColors, setConfettiColors] = useState<string[] | undefined>(undefined);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollNextPrompt = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await fetch("/api/mascot/next-prompt");
      if (res.ok) {
        const { prompt } = await res.json();
        if (prompt) {
          const key = prompt.type === "achievement" ? `ach:${prompt.achievementId}` : `chk:${prompt.applicationId}`;

          if (!dismissedRef.current.has(key)) {
            const next: PassivePrompt =
              prompt.type === "achievement"
                ? {
                    kind: "achievement",
                    achievementId: prompt.achievementId,
                    label: prompt.label,
                    description: prompt.description,
                    xpReward: prompt.xpReward,
                    tier: prompt.tier,
                  }
                : {
                    kind: "checkin",
                    applicationId: prompt.applicationId,
                    scholarshipTitle: prompt.scholarshipTitle,
                    reason: prompt.reason,
                  };

            setPassivePrompt(next);

            if (lastSeenPromptIdRef.current !== key) {
              lastSeenPromptIdRef.current = key;
              setAttention(true);
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate([120, 60, 120]);
              }
              if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
              attentionTimeoutRef.current = setTimeout(() => setAttention(false), 2000);
            }
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
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
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
    dismissedRef.current.add(`chk:${applicationId}`);
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
    dismissedRef.current.add(`chk:${applicationId}`);
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
    dismissedRef.current.add(`chk:${applicationId}`);
    setPassivePrompt(null);
  }

  async function acknowledgeAchievement(achievementId: string) {
    setSubmitting(true);
    await fetch("/api/achievements/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achievement_id: achievementId }),
    }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(`ach:${achievementId}`);
    setPassivePrompt(null);
  }

  const confirmApply = useCallback((args: ConfirmApplyArgs) => {
    if (args.alreadyTracked) {
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
    window.open(activePrompt.applicationUrl, "_blank", "noreferrer");
    setActivePrompt(null);
    setOpen(false);
  }

  const prompt: AdePromptState = activePrompt ?? passivePrompt;
  const hasPending = Boolean(prompt);

  function handleAvatarClick() {
    setOpen((wasOpen) => {
      const nextOpen = !wasOpen;

      if (
        nextOpen &&
        passivePrompt?.kind === "achievement" &&
        !confettiShownRef.current.has(passivePrompt.achievementId)
      ) {
        confettiShownRef.current.add(passivePrompt.achievementId);
        setConfettiColors(TIER_CONFETTI_COLORS[passivePrompt.tier]);
        if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = setTimeout(() => setConfettiColors(undefined), 2600);
      }

      return nextOpen;
    });
    setAttention(false);
  }

  return (
    <AdeContext.Provider value={{ confirmApply }}>
      {children}

      {confettiColors && <Confetti colors={confettiColors} pieceCount={70} durationMs={2600} />}

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
                    provider&apos;s site, check in with you after deadlines pass, and let you know when
                    you&apos;ve earned something. Nothing to tell you about right now -- you&apos;re all
                    caught up.
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
                      You&apos;re tracking <span className="font-medium">{prompt.scholarshipTitle}</span> now{" "}
                      {"\u2713"}. Tap below when you&apos;re ready to head to the application.
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

                {prompt?.kind === "achievement" && (
                  <div className="badge-pop-in">
                    <p className="text-sm text-ink leading-snug">
                      You unlocked <span className="font-medium">{prompt.label}</span> -- {prompt.description}
                    </p>
                    <p className="text-xs font-mono text-emerald mt-1">+{prompt.xpReward} XP</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => acknowledgeAchievement(prompt.achievementId)}
                        className="text-xs font-medium text-white bg-emerald rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        Nice!
                      </button>
                      <Link
                        href="/achievements"
                        onClick={() => acknowledgeAchievement(prompt.achievementId)}
                        className="text-xs font-medium text-navy-light hover:text-navy"
                      >
                        View achievements &rarr;
                      </Link>
                    </div>
                  </div>
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
          onClick={handleAvatarClick}
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
