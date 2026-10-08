"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { enableBrowserPush } from "@/lib/push/browser";
import { createClient } from "@/lib/supabase/client";
import { useOverlayAccessibility } from "@/lib/useOverlayAccessibility";
import { SpinnerIcon } from "@/components/icons";

type Props = { publicKey: string | null; isAdmin: boolean };
const PROMPT_KEY = "scholars:push-opt-in:last-shown";
const PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const FIRST_PROMPT_DELAY_MS = 12_000;
const SESSION_RETRY_MS = 10_000;
const ELIGIBLE_ROUTES = [
  "/dashboard",
  "/discover",
  "/opportunities",
  "/scholarships",
  "/applications",
  "/achievements",
  "/notifications",
  "/settings",
];
let lastShownInMemory = 0;

type StandaloneNavigator = Navigator & { standalone?: boolean };

function readLastShown(): number {
  try {
    const stored = Number(window.localStorage.getItem(PROMPT_KEY));
    if (Number.isFinite(stored) && stored > 0) return Math.max(stored, lastShownInMemory);
  } catch {
    // Use the session fallback below when local storage is unavailable.
  }
  try {
    const stored = Number(window.sessionStorage.getItem(PROMPT_KEY));
    if (Number.isFinite(stored) && stored > 0) return Math.max(stored, lastShownInMemory);
  } catch {
    // In-memory state still prevents repeat prompts during this page session.
  }
  return lastShownInMemory;
}

function saveLastShown(timestamp: number): void {
  lastShownInMemory = timestamp;
  try {
    window.localStorage.setItem(PROMPT_KEY, String(timestamp));
    return;
  } catch {
    // Private browsing modes can disable local storage; use session storage.
  }
  try {
    window.sessionStorage.setItem(PROMPT_KEY, String(timestamp));
  } catch {
    // The prompt remains usable even when both storage mechanisms are blocked.
  }
}

function isEligibleRoute(pathname: string): boolean {
  return ELIGIBLE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function canUsePushHere(): boolean {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const isIos = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as StandaloneNavigator).standalone);
  return !isIos || isStandalone;
}

export function PushNotificationPrompt({ publicKey, isAdmin }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");

  const close = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);
  const dialogRef = useOverlayAccessibility(open, close);

  useEffect(() => {
    if (open || isAdmin || !publicKey || !isEligibleRoute(pathname) || !canUsePushHere()) return;
    if (Notification.permission !== "default") return;

    let active = true;
    let timer: number;
    const supabase = createClient();

    async function considerPrompt() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active || error || !data.user || Notification.permission !== "default") return;

        const registration = await navigator.serviceWorker.getRegistration("/");
        const existingSubscription = await registration?.pushManager.getSubscription();
        if (!active || existingSubscription) return;

        // Avoid stacking this opt-in over another app dialog (e.g. a first-run prompt).
        if (document.querySelector('[role="dialog"]')) {
          timer = window.setTimeout(() => void considerPrompt(), SESSION_RETRY_MS);
          return;
        }

        const lastShown = readLastShown();
        const remainingCooldown = lastShown > 0
          ? PROMPT_COOLDOWN_MS - (Date.now() - lastShown)
          : 0;
        if (remainingCooldown > 0) {
          timer = window.setTimeout(() => void considerPrompt(), remainingCooldown);
          return;
        }

        saveLastShown(Date.now());
        setOpen(true);
      } catch {
        // Push opt-in is optional; never let a failed auth or browser check affect the app.
      }
    }

    const lastShown = readLastShown();
    const initialDelay = lastShown > 0
      ? Math.max(1_000, PROMPT_COOLDOWN_MS - (Date.now() - lastShown))
      : FIRST_PROMPT_DELAY_MS;
    timer = window.setTimeout(() => void considerPrompt(), initialDelay);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isAdmin, open, pathname, publicKey]);

  async function enableNotifications() {
    if (!publicKey || busy) return;
    setBusy(true);
    setMessage("");
    setBlocked(false);
    try {
      const permission = await enableBrowserPush(publicKey);
      if (permission === "granted") {
        setOpen(false);
      } else if (permission === "denied") {
        setBlocked(true);
        setMessage("Notifications are blocked in your browser. Allow them in site settings, then enable them from Profile.");
      } else {
        setMessage("No permission change yet. You can try again or choose “Maybe later”.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/55 p-0 sm:items-center sm:p-4"
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
        aria-describedby="push-prompt-description"
        className="w-full max-w-md rounded-t-3xl border border-hairline bg-white px-6 pb-7 pt-7 shadow-card sm:rounded-2xl sm:px-8 sm:py-8"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald">A helpful heads-up</p>
        <h2 id="push-prompt-title" className="mt-2 font-display text-2xl font-semibold leading-tight text-navy">
          Get scholarship alerts on your phone
        </h2>
        <p id="push-prompt-description" className="mt-3 text-sm leading-6 text-navy-light">
          Hear about new matches and saved-scholarship deadlines, even when Scholars is closed.
        </p>
        <ul className="mt-5 space-y-3 rounded-xl bg-parchment px-4 py-4 text-sm text-ink">
          <li className="flex items-start gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />New scholarships that fit your profile</li>
          <li className="flex items-start gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />A reminder before a saved opportunity closes</li>
        </ul>
        <p className="mt-4 text-xs leading-5 text-navy-light">You can turn alerts off anytime from your Profile.</p>
        {message && <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-amber/10 px-3 py-2 text-sm text-navy">{message}</p>}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => void enableNotifications()}
            disabled={busy || blocked}
            aria-busy={busy}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-seal bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
          >
            {busy ? <><SpinnerIcon className="mr-2" /><span>Enabling alerts…</span></> : blocked ? "Notifications blocked" : "Enable notifications"}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-seal px-5 text-sm font-medium text-navy-light transition-colors hover:bg-parchment hover:text-navy disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
