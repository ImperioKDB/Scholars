"use client";

import { useEffect, useState } from "react";

type Props = { publicKey: string | null };
type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};
type StandaloneNavigator = Navigator & { standalone?: boolean };

function decodeApplicationServerKey(value: string): Uint8Array {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function subscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) return null;
  return {
    endpoint: value.endpoint,
    expirationTime: value.expirationTime ?? null,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}

async function saveSubscription(payload: PushSubscriptionPayload): Promise<void> {
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Could not save your notification settings. Please try again.");
}

export function PushNotificationSettings({ publicKey }: Props) {
  const [supported, setSupported] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
            await saveSubscription(payload);
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
    setBusy(true);
    setMessage("");
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setMessage(permissionResult === "denied"
          ? "Notifications are blocked in your browser settings. Allow them there, then try again."
          : "Notification permission was not granted.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(publicKey) as BufferSource,
        });
      const payload = subscriptionPayload(subscription);
      if (!payload) throw new Error("Your browser returned an incomplete push subscription. Please try again.");
      await saveSubscription(payload);
      setEnabled(true);
      setMessage("Push notifications are on for this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const payload = subscriptionPayload(subscription);
        if (payload) {
          const response = await fetch("/api/push/subscription", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: payload.endpoint }),
          });
          if (!response.ok) throw new Error("Could not update your notification settings. Please try again.");
        }
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Push notifications are off for this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not turn notifications off. Please try again.");
    } finally {
      setBusy(false);
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
          onClick={() => void (enabled ? disableNotifications() : enableNotifications())}
          className="inline-flex min-h-11 items-center justify-center rounded-seal bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          {busy ? "Updating…" : enabled ? "Turn off push notifications" : "Enable push notifications"}
        </button>
      )}
      {permission === "denied" && supported && !isIos && (
        <p className="text-xs text-navy-light">Your browser has blocked notifications. Change the permission in the browser’s site settings first.</p>
      )}
      {message && <p role="status" aria-live="polite" className="text-sm text-navy-light">{message}</p>}
    </div>
  );
}
