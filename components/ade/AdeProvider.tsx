"use client";
// components/ade/AdeProvider.tsx
//
// Ade is the app's application-status recorder: Scholars cannot see what
// happens on a provider's own portal, so Ade asks the student and writes
// the answer into applications.status. Three entry points:
//   1. interceptApply() -- the detail page hands the apply click to Ade
//      BEFORE the browser leaves. Ade offers to track the scholarship
//      (or record the link click when already tracked), then opens the
//      portal. Tracking happens at the moment of intent.
//   2. confirmApply() -- legacy entry for ApplicationsClient's
//      "Open application" link: records the click and opens the portal.
//   3. poll() -- GET /api/mascot/next-prompt on mount and window focus;
//      surfaces the follow-up check-in once the student is back, plus
//      unannounced achievements.
// Visibility: the button renders on ADE_ROUTES only, never on auth or
// public pages. The rose pip is reserved for a genuinely pending prompt.
import { useCallback, useEffect, useRef, useState, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { Confetti } from "@/components/Confetti";
import { fetchWithTimeout } from "@/lib/fetch";
import type { AdePrompt } from "@/lib/ade/types";

const ADE_ROUTES = [
  "/dashboard",
  "/applications",
  "/achievements",
  "/scholarships",
  "/discover",
  "/opportunities",
  "/settings",
  "/onboarding",
];

type CheckinPrompt = { type: "checkin" } & AdePrompt;
type AchievementPrompt = {
  type: "achievement";
  achievementId: string;
  label: string;
  description: string;
  xpReward: number;
  tier: string;
};
type Prompt = CheckinPrompt | AchievementPrompt;

export type ApplyIntercept = {
  scholarshipId: string;
  scholarshipTitle: string;
  applicationUrl: string;
  applicationId: string | null;
};

const TIER_CONFETTI: Record<string, string[]> = {
  bronze: ["#0B1E3D", "#966216", "#14315C"],
  silver: ["#0B1E3D", "#15705A", "#14315C"],
  gold: ["#966216", "#15705A", "#0B1E3D"],
};

const STATUS_OPTIONS: { value: "submitted" | "accepted" | "rejected" | "in_progress"; label: string }[] = [
  { value: "submitted", label: "I submitted it" },
  { value: "accepted", label: "I got it" },
  { value: "rejected", label: "It did not work out" },
  { value: "in_progress", label: "Still working on it" },
];

type AdeContextValue = {
  poll: () => Promise<void>;
  confirmApply: (params: {
    scholarshipTitle: string;
    applicationUrl: string | null;
    alreadyTracked: boolean;
    applicationId: string;
    onTrack: () => Promise<{ id: string }>;
  }) => Promise<void>;
  interceptApply: (params: ApplyIntercept) => void;
};

const AdeContext = createContext<AdeContextValue | null>(null);

export function useAde(): AdeContextValue {
  const ctx = useContext(AdeContext);
  if (!ctx) {
    return { poll: async () => {}, confirmApply: async () => {}, interceptApply: () => {} };
  }
  return ctx;
}

// Minimal owl: two eyes, nothing else.
function AdeEyes() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8.5" cy="12" r="3.5" />
      <circle cx="15.5" cy="12" r="3.5" />
      <circle cx="8.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AdeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive =
    Boolean(pathname) && ADE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [applyIntercept, setApplyIntercept] = useState<ApplyIntercept | null>(null);
  const [open, setOpen] = useState(false);
  const [attention, setAttention] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confettiColors, setConfettiColors] = useState<string[] | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const confettiShownRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!isActive) return;
    try {
      const res = await fetchWithTimeout("/api/mascot/next-prompt", { timeoutMs: 8000 });
      if (!res.ok) {
        setPrompt(null);
        return;
      }
      const data = (await res.json()) as { prompt: Prompt | null };
      const p = data.prompt;
      if (!p) {
        setPrompt(null);
        return;
      }
      setPrompt(p);
      const key = p.type === "checkin" ? `checkin:${p.applicationId}:${p.reason}` : `achievement:${p.achievementId}`;
      if (lastKeyRef.current !== key) {
        lastKeyRef.current = key;
        setAttention(true);
        window.setTimeout(() => setAttention(false), 2000);
      }
    } catch {
      // silent: Ade never blocks the app on his own network calls
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      setPrompt(null);
      setOpen(false);
      setApplyIntercept(null);
      return;
    }
    poll();
    function onFocus() {
      poll();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isActive, poll]);

  function openExternal(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function recordClick(applicationId: string) {
    try {
      await fetchWithTimeout(`/api/applications/${applicationId}/click`, { method: "POST" });
    } catch {
      // silent
    }
  }

  const interceptApply = useCallback((params: ApplyIntercept) => {
    setApplyIntercept(params);
    setOpen(true);
    setAttention(true);
    window.setTimeout(() => setAttention(false), 2000);
  }, []);

  async function trackAndOpen() {
    if (!applyIntercept) return;
    setBusy(true);
    let applicationId = applyIntercept.applicationId;
    if (!applicationId) {
      try {
        const res = await fetchWithTimeout("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scholarship_id: applyIntercept.scholarshipId }),
        });
        if (res.ok) {
          const data = (await res.json()) as { application?: { id: string } };
          applicationId = data.application?.id ?? null;
        }
      } catch {
        // fall through: the external link still opens even if tracking failed
      }
    }
    if (applicationId) await recordClick(applicationId);
    setBusy(false);
    openExternal(applyIntercept.applicationUrl);
    setApplyIntercept(null);
    setOpen(false);
    lastKeyRef.current = null;
    poll();
  }

  async function recordAndOpen() {
    if (!applyIntercept || !applyIntercept.applicationId) return;
    setBusy(true);
    await recordClick(applyIntercept.applicationId);
    setBusy(false);
    openExternal(applyIntercept.applicationUrl);
    setApplyIntercept(null);
    setOpen(false);
    lastKeyRef.current = null;
    poll();
  }

  function openWithoutRecording() {
    if (!applyIntercept) return;
    openExternal(applyIntercept.applicationUrl);
    setApplyIntercept(null);
    setOpen(false);
  }

  const confirmApply = useCallback(
    async (params: {
      scholarshipTitle: string;
      applicationUrl: string | null;
      alreadyTracked: boolean;
      applicationId: string;
      onTrack: () => Promise<{ id: string }>;
    }) => {
      const { applicationUrl, alreadyTracked, applicationId, onTrack } = params;
      if (alreadyTracked && applicationUrl) {
        await recordClick(applicationId);
        openExternal(applicationUrl);
      }
      try {
        await onTrack();
      } catch {
        // silent
      }
      await poll();
    },
    [poll]
  );

  async function answerCheckin(applicationId: string, body: unknown) {
    setBusy(true);
    try {
      await fetchWithTimeout(`/api/applications/${applicationId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // silent
    }
    setBusy(false);
    setOpen(false);
    lastKeyRef.current = null;
    poll();
  }

  async function announceAchievement(achievementId: string) {
    try {
      await fetchWithTimeout("/api/achievements/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievement_id: achievementId }),
      });
    } catch {
      // silent
    }
    setOpen(false);
    lastKeyRef.current = null;
    poll();
  }

  function openPanel() {
    setOpen((o) => !o);
    if (prompt?.type === "achievement" && !confettiShownRef.current.has(prompt.achievementId)) {
      confettiShownRef.current.add(prompt.achievementId);
      setConfettiColors(TIER_CONFETTI[prompt.tier] ?? null);
    }
  }

  const contextValue: AdeContextValue = { poll, confirmApply, interceptApply };

  return (
    <AdeContext.Provider value={contextValue}>
      {children}
      {confettiColors && <Confetti colors={confettiColors} />}
      {isActive && (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[95] flex flex-col items-end gap-3">
          {open && (
            <div className="bg-white rounded-2xl border border-hairline shadow-card p-5 w-[19rem] max-w-[calc(100vw-2rem)]">
              {applyIntercept ? (
                <>
                  <p className="font-display text-base font-semibold text-navy mb-1">Ade says hi</p>
                  {applyIntercept.applicationId ? (
                    <p className="text-sm text-ink leading-relaxed mb-4">
                      Good luck with <span className="font-medium">{applyIntercept.scholarshipTitle}</span>. I will
                      note that you opened the link and check in with you when you are back.
                    </p>
                  ) : (
                    <p className="text-sm text-ink leading-relaxed mb-4">
                      Before you go: I can track <span className="font-medium">{applyIntercept.scholarshipTitle}</span>{" "}
                      for you, so its deadline and status stay on your dashboard and I can ask how it went.
                    </p>
                  )}
                  <div className="space-y-2">
                    {applyIntercept.applicationId ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={recordAndOpen}
                        className="w-full rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
                      >
                        Record and open the link
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={trackAndOpen}
                        className="w-full rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
                      >
                        Track it and open the link
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={openWithoutRecording}
                      className="w-full text-left rounded-lg border border-hairline px-3.5 py-2.5 text-sm text-ink hover:border-navy/40 hover:bg-navy-50 transition-colors disabled:opacity-60"
                    >
                      {applyIntercept.applicationId ? "Open without recording" : "Open without tracking"}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setApplyIntercept(null);
                      setOpen(false);
                    }}
                    className="text-xs font-medium text-navy-light hover:text-navy mt-3 disabled:opacity-60"
                  >
                    Not now
                  </button>
                </>
              ) : prompt ? (
                prompt.type === "checkin" ? (
                  <>
                    <p className="font-display text-base font-semibold text-navy mb-1">Ade says hi</p>
                    <p className="text-sm text-ink leading-relaxed mb-4">
                      How did it go with <span className="font-medium">{prompt.scholarshipTitle}</span>?{" "}
                      {prompt.reason === "clicked" ? "You opened the application link last time." : "The deadline has passed."}
                    </p>
                    <div className="space-y-2">
                      {STATUS_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          disabled={busy}
                          onClick={() => answerCheckin(prompt.applicationId, { action: "answer", status: o.value })}
                          className="w-full text-left rounded-lg border border-hairline px-3.5 py-2.5 text-sm text-ink hover:border-navy/40 hover:bg-navy-50 transition-colors disabled:opacity-60"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => answerCheckin(prompt.applicationId, { action: "not_open_yet" })}
                        className="text-xs font-medium text-navy-light hover:text-navy disabled:opacity-60"
                      >
                        Portal not open yet
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => answerCheckin(prompt.applicationId, { action: "snooze" })}
                        className="text-xs font-medium text-navy-light hover:text-navy disabled:opacity-60"
                      >
                        Ask me later
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-display text-base font-semibold text-navy mb-1">Achievement unlocked</p>
                    <p className="badge-pop-in text-sm font-medium text-emerald mb-1">{prompt.label}</p>
                    <p className="text-sm text-ink leading-relaxed mb-3">{prompt.description}</p>
                    <p className="text-xs font-mono text-navy-light mb-4">+{prompt.xpReward} XP</p>
                    <button
                      type="button"
                      onClick={() => announceAchievement(prompt.achievementId)}
                      className="w-full rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
                    >
                      Nice, thanks Ade
                    </button>
                  </>
                )
              ) : (
                <>
                  <p className="font-display text-base font-semibold text-navy mb-1">Ade is here</p>
                  <p className="text-sm text-ink leading-relaxed">
                    Nothing needs your attention right now. I check in after you open a scholarship portal, when a
                    tracked deadline passes, and when you unlock an achievement.
                  </p>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={openPanel}
            aria-label={open ? "Close Ade" : "Open Ade"}
            className={
              "relative w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center shadow-card hover:bg-navy-light transition-colors " +
              (attention ? "ade-attention" : "")
            }
          >
            <AdeEyes />
            {prompt && (
              <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-rose border-2 border-white" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </AdeContext.Provider>
  );
}
