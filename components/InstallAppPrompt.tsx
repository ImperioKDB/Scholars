"use client";
import { useEffect, useRef, useState } from "react";
import { recordPromptAction } from "@/lib/onboarding-prompt-client";
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };
type InstallResult = "installed" | "dismissed" | "unavailable";
type Controller = { request: () => Promise<InstallResult>; isAvailable: () => boolean };
let controller: Controller | null = null;
export function isInstallPromptAvailable() { return controller?.isAvailable() ?? false; }
export function requestInstallPrompt(): Promise<InstallResult> { return controller?.request() ?? Promise.resolve("unavailable"); }
const AUTO_DISMISS_MS = 10_000;
export function InstallAppPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const settle = useRef<((result: InstallResult) => void) | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isVisibleRef = useRef(false);
  useEffect(() => {
    const finish = (result: InstallResult) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      isVisibleRef.current = false;
      setIsVisible(false);
      const resolve = settle.current;
      settle.current = null;
      resolve?.(result);
    };
    const onBeforeInstallPrompt = (event: Event) => { event.preventDefault(); deferredPrompt.current = event as BeforeInstallPromptEvent; };
    const onAppInstalled = () => { deferredPrompt.current = null; void recordPromptAction("pwa_installed"); finish("installed"); };
    const request = () => {
      if (!deferredPrompt.current || isVisibleRef.current) return Promise.resolve("unavailable" as const);
      isVisibleRef.current = true;
      setIsVisible(true);
      return new Promise<InstallResult>((resolve) => { settle.current = resolve; dismissTimer.current = setTimeout(() => finish("dismissed"), AUTO_DISMISS_MS); });
    };
    controller = { request, isAvailable: () => deferredPrompt.current !== null };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt); window.removeEventListener("appinstalled", onAppInstalled); if (dismissTimer.current) clearTimeout(dismissTimer.current); controller = null; };
  }, []);
  async function installApp() {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent || !settle.current) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    deferredPrompt.current = null;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      const resolve = settle.current; settle.current = null; isVisibleRef.current = false; setIsVisible(false);
      if (choice.outcome === "accepted") resolve?.("installed"); else resolve?.("dismissed");
    } catch { const resolve = settle.current; settle.current = null; isVisibleRef.current = false; setIsVisible(false); resolve?.("dismissed"); }
  }
  function dismiss() { if (dismissTimer.current) clearTimeout(dismissTimer.current); isVisibleRef.current = false; setIsVisible(false); settle.current?.("dismissed"); settle.current = null; }
  if (!isVisible) return null;
  return <div className="fixed inset-x-4 bottom-4 z-[70] sm:left-auto sm:right-6 sm:max-w-sm" role="dialog" aria-modal="false" aria-labelledby="install-app-title"><div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_18px_50px_rgba(11,30,61,0.18)]"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white" aria-hidden="true">⇩</div><div className="min-w-0 flex-1"><h2 id="install-app-title" className="font-display text-lg font-semibold leading-tight text-navy">Add Scholars to your home screen</h2><p className="mt-1.5 text-sm leading-5 text-navy-light">Get a faster, more convenient experience whenever you return to find your next opportunity.</p></div><button type="button" onClick={dismiss} className="-mr-1 -mt-1 rounded-full p-2 text-navy-light hover:bg-parchment hover:text-navy" aria-label="Dismiss install prompt">×</button></div><button type="button" onClick={() => void installApp()} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-seal bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-light">Add to home screen</button></div></div>;
}
declare global { interface Navigator { standalone?: boolean } }
