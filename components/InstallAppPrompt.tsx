"use client";

import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const SESSION_SHOWN_KEY = "scholars:install-prompt-shown";
const AUTO_DISMISS_MS = 10_000;

export function InstallAppPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      return;
    }

    // Registering the service worker makes the manifest eligible for the
    // browser's install event without changing the app's network behavior.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installation is an enhancement; a registration failure must not
        // affect the rest of the app.
      });
    }

    if (window.sessionStorage.getItem(SESSION_SHOWN_KEY) === "1") {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      window.sessionStorage.setItem(SESSION_SHOWN_KEY, "1");
      setIsVisible(true);

      dismissTimer.current = setTimeout(() => {
        setIsVisible(false);
        deferredPrompt.current = null;
      }, AUTO_DISMISS_MS);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  async function installApp() {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return;

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    deferredPrompt.current = null;
    setIsVisible(false);

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // The browser can reject a prompt if install state changes mid-flow.
      // The app should remain usable either way.
    }
  }

  function dismiss() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    deferredPrompt.current = null;
    setIsVisible(false);
  }

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[70] sm:left-auto sm:right-6 sm:max-w-sm" role="dialog" aria-modal="false" aria-labelledby="install-app-title">
      <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_18px_50px_rgba(11,30,61,0.18)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v1.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V17" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="install-app-title" className="font-display text-lg font-semibold leading-tight text-navy">
              Add Scholars to your home screen
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-navy-light">
              Get a faster, more convenient experience whenever you return to find your next opportunity.
            </p>
          </div>
          <button type="button" onClick={dismiss} className="-mr-1 -mt-1 rounded-full p-2 text-navy-light hover:bg-parchment hover:text-navy" aria-label="Dismiss install prompt">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button type="button" onClick={installApp} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-seal bg-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2">
          Add to home screen
        </button>
      </div>
    </div>
  );
}


declare global {
  interface Navigator {
    standalone?: boolean;
  }
}
