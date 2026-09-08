"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Confetti } from "@/components/Confetti";

type CheckinReason = "clicked" | "deadline_passed";
type CheckinPrompt = { kind: "checkin"; applicationId: string; scholarshipTitle: string; reason: CheckinReason };
type AchievementPrompt = { kind: "achievement"; achievementId: string; label: string; description: string; xpReward: number; tier: string };
type PassivePrompt = CheckinPrompt | AchievementPrompt;
type ApplyGuardPrompt = { kind: "apply_guard"; scholarshipTitle: string; applicationUrl: string; onTrack: () => Promise<{ id: string } | null> };
type ReadyToOpenPrompt = { kind: "ready_to_open"; scholarshipTitle: string; applicationUrl: string; applicationId: string };
type ActivePrompt = ApplyGuardPrompt | ReadyToOpenPrompt;
type AdePromptState = ActivePrompt | PassivePrompt | null;
type ConfirmApplyArgs = { scholarshipTitle: string; applicationUrl: string; alreadyTracked: boolean; applicationId?: string; onTrack: () => Promise<{ id: string } | null> };
type AdeContextValue = { confirmApply: (args: ConfirmApplyArgs) => void };

const AdeContext = createContext<AdeContextValue | null>(null);

export function useAde(): AdeContextValue {
  const ctx = useContext(AdeContext);
  if (!ctx) return { confirmApply: (args) => { window.open(args.applicationUrl, "_blank", "noreferrer"); } };
  return ctx;
}

const ADE_ROUTES = ["/dashboard", "/applications", "/achievements", "/scholarships"];

const STATUS_OPTIONS: { value: "submitted" | "in_progress" | "rejected"; label: string }[] = [
  { value: "submitted", label: "I applied" },
  { value: "in_progress", label: "Still working on it" },
  { value: "rejected", label: "Changed my mind" },
];

// COLOR CONSISTENCY (refactor batch 1): tier confetti + avatar now use the
// darkened WCAG tokens from tailwind.config.ts (emerald #15705A, amber
// #966216) instead of the old pre-audit hexes, so Ade matches every other
// surface in the app.
const TIER_CONFETTI_COLORS: Record<string, string[]> = {
  bronze: ["#966216", "#0B1E3D", "#F7F5EF"],
  silver: ["#8B93A3", "#0B1E3D", "#F7F5EF"],
  gold: ["#15705A", "#966216", "#0B1E3D"],
};

function AdeAvatar({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <circle cx="20" cy="20" r="20" fill="#15705A" />
      <ellipse cx="14.5" cy="19" rx="5" ry="6" fill="#F7F5EF" />
      <ellipse cx="25.5" cy="19" rx="5" ry="6" fill="#F7F5EF" />
      <circle cx="14.5" cy="19.5" r="2.2" fill="#0B1E3D" />
      <circle cx="25.5" cy="19.5" r="2.2" fill="#0B1E3D" />
      <path d="M20 21.5l-2.3 3.5h4.6L20 21.5Z" fill="#966216" />
      <path d="M11 12.5 15 16M29 12.5 25 16" stroke="#F7F5EF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AdeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
  const confettiShownRef = useRef<Set<string>>(new Set());
  const [confettiColors, setConfettiColors] = useState<string[] | undefined>(undefined);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const avatarRef = useRef<HTMLButtonElement | null>(null);

  const isActive = Boolean(pathname) && ADE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

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
            const next: PassivePrompt = prompt.type === "achievement"
              ? { kind: "achievement", achievementId: prompt.achievementId, label: prompt.label, description: prompt.description, xpReward: prompt.xpReward, tier: prompt.tier }
              : { kind: "checkin", applicationId: prompt.applicationId, scholarshipTitle: prompt.scholarshipTitle, reason: prompt.reason };
            setPassivePrompt(next);
            if (lastSeenPromptIdRef.current !== key) {
              lastSeenPromptIdRef.current = key;
              setAttention(true);
              if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([120, 60, 120]);
              if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
              attentionTimeoutRef.current = setTimeout(() => setAttention(false), 2000);
            }
          }
        }
      }
    } catch {
      // Silent -- Ade is a nice-to-have.
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    pollNextPrompt();
    function onFocus() { pollNextPrompt(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pollNextPrompt, isActive]);

  useEffect(() => () => {
    if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
  }, []);

  useEffect(() => { if (open) closeButtonRef.current?.focus(); }, [open]);

  async function answerCheckin(applicationId: string, status: "submitted" | "in_progress" | "rejected") {
    setSubmitting(true);
    await fetch(`/api/applications/${applicationId}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "answer", status }) }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(`chk:${applicationId}`);
    setPassivePrompt(null);
  }

  async function snoozeCheckin(applicationId: string) {
    setSubmitting(true);
    await fetch(`/api/applications/${applicationId}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "snooze" }) }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(`chk:${applicationId}`);
    setPassivePrompt(null);
  }

  async function markNotOpenYet(applicationId: string) {
    setSubmitting(true);
    await fetch(`/api/applications/${applicationId}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "not_open_yet" }) }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(`chk:${applicationId}`);
    setPassivePrompt(null);
  }

  async function acknowledgeAchievement(achievementId: string) {
    setSubmitting(true);
    await fetch("/api/achievements/announce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ achievement_id: achievementId }) }).catch(() => {});
    setSubmitting(false);
    dismissedRef.current.add(`ach:${achievementId}`);
    setPassivePrompt(null);
  }

  const confirmApply = useCallback((args: ConfirmApplyArgs) => {
    if (args.alreadyTracked) {
      if (args.applicationId) fetch(`/api/applications/${args.applicationId}/click`, { method: "POST" }).catch(() => {});
      window.open(args.applicationUrl, "_blank", "noreferrer");
      return;
    }
    setTrackError(null);
    setActivePrompt({ kind: "apply_guard", scholarshipTitle: args.scholarshipTitle, applicationUrl: args.applicationUrl, onTrack: args.onTrack });
    setOpen(true);
  }, []);

  async function handleTrackFirst() {
    if (!activePrompt || activePrompt.kind !== "apply_guard") return;
    setTrackError(null); setTrackingInFlight(true);
    const result = await activePrompt.onTrack();
    setTrackingInFlight(false);
    if (result?.id) {
      setActivePrompt({ kind: "ready_to_open", scholarshipTitle: activePrompt.scholarshipTitle, applicationUrl: activePrompt.applicationUrl, applicationId: result.id });
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
    setActivePrompt(null); setOpen(false);
  }

  function closePanel() { setOpen(false); avatarRef.current?.focus(); }

  function handlePanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); closePanel(); return; }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0]; const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  const prompt: AdePromptState = activePrompt ?? passivePrompt;
  const hasPending = Boolean(prompt);

  function handleAvatarClick() {
    setOpen((wasOpen) => {
      const nextOpen = !wasOpen;
      if (nextOpen && passivePrompt?.kind === "achievement" && !confettiShownRef.current.has(passivePrompt.achievementId)) {
        confettiShownRef.current.add(passivePrompt.achievementId);
        setConfettiColors(TIER_CONFETTI_COLORS[passivePrompt.tier]);
        if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = setTimeout(() => setConfettiColors(undefined), 2600);
      }
      return nextOpen;
    });
    setAttention(false);
  }

  if (!isActive) return <>{children}</>;

  return (
    <AdeContext.Provider value={{ confirmApply }}>
      {children}
      {confettiColors && <Confetti colors={confettiColors} pieceCount={70} durationMs={2600} />}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-[90] flex flex-col items-end gap-2">
        {open && (
          <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Ade, your application guide" onKeyDown={handlePanelKeyDown} aria-live="polite"
            className="badge-pop-in w-[calc(100vw-2rem)] max-w-80 bg-white rounded-2xl border border-hairline shadow-card p-4">
            <div className="flex items-start gap-3">
              <AdeAvatar />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-emerald mb-0.5">Ade</p>
                {!prompt && (
                  <p className="text-sm text-ink leading-snug">Hi, I&apos;m Ade! I&apos;ll remind you to track a scholarship before you head to a provider&apos;s site, check in with you after deadlines pass, and let you know when you&apos;ve earned something. Nothing to tell you about right now -- you&apos;re all caught up.</p>
                )}
                {prompt?.kind === "apply_guard" && (
                  <>
                    <p className="text-sm text-ink leading-snug">Want me to track <span className="font-medium">{prompt.scholarshipTitle}</span> before you head over? I&apos;ll follow up so it doesn&apos;t fall through the cracks.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" onClick={handleTrackFirst} disabled={trackingInFlight} className="text-xs font-medium text-white bg-emerald rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50">{trackingInFlight ? "Tracking\u2026" : "Track it first"}</button>
                      <button type="button" onClick={handleJustGo} disabled={trackingInFlight} className="text-xs font-medium text-navy-light hover:text-navy disabled:opacity-50">Just take me there</button>
                    </div>
                    {trackError && <p className="text-xs text-rose mt-2">{trackError}</p>}
                  </>
                )}
                {prompt?.kind === "ready_to_open" && (
                  <>
                    <p className="text-sm text-ink leading-snug">You&apos;re tracking <span className="font-medium">{prompt.scholarshipTitle}</span> now {"\u2713"}. Tap below when you&apos;re ready to head to the application.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" onClick={handleContinueToApplication} className="text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors">Continue to application &rarr;</button>
                    </div>
                  </>
                )}
                {prompt?.kind === "checkin" && (
                  <>
                    <p className="text-sm text-ink leading-snug">
                      {prompt.reason === "clicked" ? (<>How did it go with <span className="font-medium">{prompt.scholarshipTitle}</span>? Answering helps me match you better next time.</>) : (<><span className="font-medium">{prompt.scholarshipTitle}</span>&apos;s deadline has passed -- did you hear back?</>)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {STATUS_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" disabled={submitting} onClick={() => answerCheckin(prompt.applicationId, opt.value)} className="text-xs font-medium text-white bg-navy rounded-full px-3 py-1.5 hover:bg-navy-light transition-colors disabled:opacity-50">{opt.label}</button>
                      ))}
                      <button type="button" disabled={submitting} onClick={() => markNotOpenYet(prompt.applicationId)} className="text-xs font-medium text-navy-light border border-hairline rounded-full px-3 py-1.5 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-50">Portal not open yet</button>
                    </div>
                    <button type="button" disabled={submitting} onClick={() => snoozeCheckin(prompt.applicationId)} className="text-xs text-navy-light hover:text-navy mt-2 disabled:opacity-50">Ask me later</button>
                  </>
                )}
                {prompt?.kind === "achievement" && (
                  <div className="badge-pop-in">
                    <p className="text-sm text-ink leading-snug">You unlocked <span className="font-medium">{prompt.label}</span> -- {prompt.description}</p>
                    <p className="text-xs font-mono text-emerald mt-1">+{prompt.xpReward} XP</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" disabled={submitting} onClick={() => acknowledgeAchievement(prompt.achievementId)} className="text-xs font-medium text-white bg-emerald rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50">Nice!</button>
                      <Link href="/achievements" onClick={() => acknowledgeAchievement(prompt.achievementId)} className="text-xs font-medium text-navy-light hover:text-navy">View achievements &rarr;</Link>
                    </div>
                  </div>
                )}
              </div>
              <button ref={closeButtonRef} type="button" onClick={closePanel} aria-label="Close" className="relative shrink-0 text-navy-light hover:text-navy -mt-1 -mr-1 p-1 after:absolute after:-inset-[10px] after:rounded-full after:content-['']">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
        )}
        <button ref={avatarRef} type="button" onClick={handleAvatarClick} aria-label={open ? "Close Ade" : "Open Ade"} aria-expanded={open}
          className={["relative w-14 h-14 rounded-full shadow-card border border-hairline bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform", attention ? "ade-attention" : ""].join(" ")}>
          <AdeAvatar size={40} />
          {hasPending && !open && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose border-2 border-white" />}
        </button>
      </div>
    </AdeContext.Provider>
  );
}
