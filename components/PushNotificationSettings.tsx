"use client";

import { useEffect, useState } from "react";
import { SpinnerIcon } from "@/components/icons";
import {
  disableBrowserPush,
  enableBrowserPush,
  initializeBrowserPush,
  supportsBrowserPush,
} from "@/lib/push/browser";

type Props = { publicKey: string | null; profileId: string };
type BusyAction = "enable" | "disable" | null;
type StandaloneNavigator = Navigator & { standalone?: boolean };

export function PushNotificationSettings({ publicKey, profileId }: Props) {
  const [supported, setSupported] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);
  const [state, setState] = useState<Awaited<ReturnType<typeof initializeBrowserPush>>>("missing");
  const [initializing, setInitializing] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState("");
  const busy = busyAction !== null;
  const enabled = state === "compatible" && permission === "granted";

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as StandaloneNavigator).standalone);
    const available = supportsBrowserPush();
    setIsIos(ios);
    setIsInstalled(standalone);
    setSupported(available);
    setPermission(available ? Notification.permission : "unsupported");
    if (!available || !publicKey || (ios && !standalone)) {
      setInitializing(false);
      return;
    }

    let active = true;
    const refreshPermission = () => setPermission(Notification.permission);
    window.addEventListener("focus", refreshPermission);
    setInitializing(true);
    void initializeBrowserPush(publicKey, profileId)
      .then((result) => {
        if (!active) return;
        setPermission(Notification.permission);
        setState(result);
      })
      .catch(() => {
        if (active) {
          setState("missing");
          setMessage("This device’s notification settings could not sync. Tap Enable to retry.");
        }
      })
      .finally(() => { if (active) setInitializing(false); });
    return () => {
      active = false;
      window.removeEventListener("focus", refreshPermission);
    };
  }, [publicKey, profileId]);

  async function enableNotifications() {
    if (!publicKey) {
      setMessage("Push notifications are not configured for this deployment yet.");
      return;
    }
    setBusyAction("enable");
    setMessage("");
    try {
      const permissionResult = await enableBrowserPush(publicKey, profileId);
      setPermission(Notification.permission);
      if (permissionResult === "unverifiable") {
        setState("unverifiable");
        return;
      }
      if (permissionResult !== "granted") {
        setMessage(permissionResult === "denied"
          ? "Notifications are blocked in your browser settings. Allow them there, then try again."
          : "Notification permission was not granted.");
        return;
      }
      setState("compatible");
      setMessage("Push notifications are on for this device.");
    } catch (error) {
      setPermission(Notification.permission);
      setMessage(error instanceof Error ? error.message : "Could not enable notifications. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function disableNotifications() {
    setBusyAction("disable");
    setMessage("");
    try {
      await disableBrowserPush(profileId);
      setState("missing");
      setMessage("Push notifications are off for this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not turn notifications off. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  const unavailable = !supported || !publicKey || (isIos && !isInstalled);
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-navy-light">
        Get timely Scholars updates on this device, even when the app is closed. Email and your in-app inbox stay available too.
      </p>
      {isIos && !isInstalled ? (
        <p className="rounded-xl bg-parchment px-4 py-3 text-sm leading-5 text-navy">
          On iPhone or iPad, add Scholars to your Home Screen from Safari, open it from the new icon, then enable alerts here. Web Push requires iOS or iPadOS 16.4 or later.
        </p>
      ) : !supported ? (
        <p className="text-sm text-navy-light">This browser does not support push notifications. Try a recent version of Safari, Chrome, or Firefox.</p>
      ) : !publicKey ? (
        <p className="text-sm text-navy-light">Push notifications are not configured for this deployment yet.</p>
      ) : state !== "unverifiable" && (
        <button
          type="button"
          disabled={busy || initializing || unavailable || (!enabled && permission === "denied")}
          aria-busy={busy}
          onClick={() => void (enabled ? disableNotifications() : enableNotifications())}
          className="inline-flex min-h-11 items-center justify-center rounded-seal bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          {busy ? (
            <><SpinnerIcon className="mr-2" /><span>{busyAction === "enable" ? "Enabling alerts…" : "Turning alerts off…"}</span></>
          ) : enabled ? "Turn off push notifications" : state === "incompatible" ? "Repair push notifications" : "Enable push notifications"}
        </button>
      )}
      {!unavailable && !initializing && !enabled && (state === "incompatible" || state === "unverifiable") && (
        <>
          <p className="text-sm text-navy-light">
            {state === "incompatible"
              ? "This device’s subscription uses an older notification key. Repair it to receive push alerts."
              : "This browser does not report the key for this device’s subscription. Scholars cannot verify that it can receive push alerts."}
          </p>
          <button type="button" disabled={busy} onClick={() => void disableNotifications()} className="text-sm font-semibold text-navy underline">
            Turn off push notifications
          </button>
        </>
      )}
      {permission === "denied" && supported && !isIos && (
        <p className="text-xs text-navy-light">Your browser has blocked notifications. Change the permission in the browser’s site settings first.</p>
      )}
      {message && <p role="status" aria-live="polite" className="text-sm text-navy-light">{message}</p>}
    </div>
  );
}
