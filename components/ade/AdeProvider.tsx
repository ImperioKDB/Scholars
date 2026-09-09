"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Confetti } from "@/components/Confetti";
import { fetchWithTimeout } from "@/lib/fetch";
import type { AdePrompt } from "@/lib/ade/types";

// components/ade/AdeProvider.tsx
//
// ROUTE GATE (test feedback): Ade lives ONLY on the app routes below,
// matched by exact path or prefix. /login, /signup, /reset-password and
// every public marketing route (landing, /s/[id], /legal, /about) are
// deliberately absent, so the mascot bubble can never sit on top of a
// sign-in form or a marketing page. This is an allow-list, not a
// deny-list: a new route gets no Ade until it is added here on purpose.
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

const TIER_CONFETTI: Record<string, string[]> = {
  bronze: ["#0B1E3D", "#966216", "#14315C"],
  silver: ["#0B1E3D", "#15705A", "#14315C"],
  gold: ["#966216", "#15705A", "#0B1E3D"],
};

const STATUS_OPTIONS: { value: "submitted" | "accepted" | "rejected" | "in_progress"; label: string }[] = [
  { value: "submitted", label: "I submitted it" },
  { value: "accepted", label: "I got it" },
  { value: "rejected", label: "It didn't work out" },
  { value: "in_progress", label: "Still working on it" },
];

export function AdeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = Boolean(pathname) && ADE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [open, setOpen] = useState(false);
  const [attention, setAttention] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confettiColors, setConfettiColors] = useState<string[] | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const confettiShownRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
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
      // Ade is best-effort by design: a failed poll never surfaces an
      // error to the student, it just means no prompt this time.
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      setPrompt(null);
      setOpen(false);
      return;
    }
    poll();
    function onFocus() {
      poll();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isActive, poll]);

  async function answerCheckin(applicationId: string, body: unknown) {
    setBusy(true);
    try {
      await fetchWithTimeout(`/api/applications/${applicationId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // silent: the check-in will resurface on a later poll
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
      setConfettiColors(TIER_CONFETTI[prompt.tier] ?? undefined ?? null);
    }
  }

  return (
    <>
      {children}
      {confettiColors && <Confetti colors={confettiColors} />}
      {isActive && prompt && (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[95] flex flex-col items-end gap-3">
          {open && (
            <div className="bg-white rounded-2xl border border-hairline shadow-card p-5 w-[19rem] max-w-[calc(100vw-2rem)]">
              {prompt.type === "checkin" ? (
                <>
                  <p className="font-display text-base font-semibold text-navy mb-1">Ade says hi</p>
                  <p className="text-sm text-ink leading-relaxed mb-4">
                    How did it go with{" "}
                    <span className="font-medium">{prompt.scholarshipTitle}</span>?
                    {prompt.reason === "clicked"
                      ? " You opened the application link last time."
                      : " The deadline has passed."}
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
            <span className="font-display text-lg font-semibold" aria-hidden="true">A</span>
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-rose border-2 border-white" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
