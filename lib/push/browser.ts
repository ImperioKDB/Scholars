export type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

function decodeApplicationServerKey(value: string): Uint8Array {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

export function subscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) return null;
  return {
    endpoint: value.endpoint,
    expirationTime: value.expirationTime ?? null,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}

export async function saveBrowserPushSubscription(payload: PushSubscriptionPayload): Promise<void> {
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Could not save your notification settings. Please try again.");
}

/** Request permission only after a user action, then subscribe and sync the endpoint. */
export async function enableBrowserPush(publicKey: string): Promise<NotificationPermission> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support push notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() ??
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(publicKey) as BufferSource,
    });
  const payload = subscriptionPayload(subscription);
  if (!payload) throw new Error("Your browser returned an incomplete push subscription. Please try again.");
  await saveBrowserPushSubscription(payload);
  return permission;
}

export async function disableBrowserPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

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
