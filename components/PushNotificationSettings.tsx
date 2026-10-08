"use client";

import { useEffect, useState } from "react";
import { SpinnerIcon } from "@/components/icons";
import {
  disableBrowserPush,
  enableBrowserPush,
  saveBrowserPushSubscription,
  subscriptionPayload,
} from "@/lib/push/browser";

type Props = { publicKey: string | null };
type BusyAction = "enable" | "disable" | null;
type StandaloneNavigator = Navigator & { standalone?: boolean };

export function PushNotificationSettings({ publicKey }: Props) {
  const [supported, setSupported] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState("");
  const busy = busyAction !== null;

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as StandaloneNavigator).standalone);
    const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsIos(ios);
    setIsInstalled(standalone);
    setSupported(available);
    if (!available) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    let active = true;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!active || !subscription) return;
        const payload = subscriptionPayload(subscription);
        if (!payload) return;
        if (Notification.permission === "granted") {
          try {
            await saveBrowserPushSubscription(payload);
            if (active) setEnabled(true);
          } catch {
            if (active) {
              setEnabled(false);
              setMessage("This device’s notification settings could not sync. Tap Enable to retry.");
            }
          }
        } else {
          setEnabled(true);
        }
      })
      .catch(() => {
        // Push setup is optional; report its state in the settings UI, not as a page error.
      });
    return () => { active = false; };
  }, []);

  async function enableNotifications() {
    if (!publicKey) {
      setMessage("Push notifications are not configured for this deployment yet.");
      return;
    }
    setBusyAction("enable");
    setMessage("");
    try {
      const permissionResult = await enableBrowserPush(publicKey);
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setMessage(permissionResult === "denied"
          ? "Notifications are blocked in your browser settings. Allow them there, then try again."
          : "Notification permission was not granted.");
        return;
      }
      setEnabled(true);
      setMessage("Push notifications are on for this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function disableNotifications() {
    setBusyAction("disable");
    setMessage("");
    try {
      await disableBrowserPush();
      setEnabled(false);
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
      ) : (
        <button
          type="button"
          disabled={busy || unavailable || (!enabled && permission === "denied")}
          aria-busy={busy}
          onClick={() => void (enabled ? disableNotifications() : enableNotifications())}
          className="inline-flex min-h-11 items-center justify-center rounded-seal bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          {busy ? (
            <><SpinnerIcon className="mr-2" /><span>{busyAction === "enable" ? "Enabling alerts…" : "Turning alerts off…"}</span></>
          ) : enabled ? "Turn off push notifications" : "Enable push notifications"}
        </button>
      )}
      {permission === "denied" && supported && !isIos && (
        <p className="text-xs text-navy-light">Your browser has blocked notifications. Change the permission in the browser’s site settings first.</p>
      )}
      {message && <p role="status" aria-live="polite" className="text-sm text-navy-light">{message}</p>}
    </div>
  );
}
