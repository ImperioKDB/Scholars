export type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

function decodeApplicationServerKey(value: string) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error("Push notifications are not configured correctly. Please try again later.");
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

export function subscriptionCompatibility(
  subscription: PushSubscription,
  publicKey: Uint8Array,
): "compatible" | "incompatible" | "unverifiable" {
  const key = subscription.options?.applicationServerKey;
  if (!key?.byteLength) return "unverifiable";
  const bytes = new Uint8Array(key);
  return bytes.length === publicKey.length && bytes.every((byte, index) => byte === publicKey[index])
    ? "compatible"
    : "incompatible";
}

export function supportsBrowserPush(): boolean {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

const replacementStorageKey = "scholars:push:replaced-endpoint";
const pendingReplacements = new Map<string, string>();

function replacedEndpoint(profileId: string): string | undefined {
  try {
    return window.localStorage.getItem(replacementStorageKey + ":" + profileId) ?? pendingReplacements.get(profileId);
  } catch {
    return pendingReplacements.get(profileId);
  }
}

function rememberReplacement(profileId: string, endpoint: string | null) {
  const storageKey = replacementStorageKey + ":" + profileId;
  pendingReplacements.delete(profileId);
  try {
    if (endpoint) window.localStorage.setItem(storageKey, endpoint);
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Keep retry information in memory if storage is restricted.
    if (endpoint) pendingReplacements.set(profileId, endpoint);
  }
}

async function syncSubscription(subscription: PushSubscription, profileId: string): Promise<void> {
  const payload = subscriptionPayload(subscription);
  if (!payload) throw new Error("Your browser returned an incomplete push subscription. Please try again.");
  const previous = replacedEndpoint(profileId);
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, profileId, replacedEndpoint: previous }),
  });
  if (!response.ok) throw new Error("Could not save your notification settings. Please try again.");
  if (previous) rememberReplacement(profileId, null);
}

let busy = false;
let requestingPermission = false;

async function withSubscriptionLock<T>(action: () => Promise<T>): Promise<T> {
  const retry = () => new Error("Notification settings are being updated. Please try again.");
  if (busy || requestingPermission) throw retry();
  busy = true;
  try {
    // Avoid waiting behind another tab and losing the initiating user gesture.
    if (navigator.locks) {
      return await navigator.locks.request("scholars:web-push", { ifAvailable: true }, (lock) => {
        if (!lock) throw retry();
        return action();
      });
    }
    return await action();
  } finally {
    busy = false;
  }
}

type ExistingPushState = "missing" | "compatible" | "incompatible" | "unverifiable";
let initialization: { publicKey: string; profileId: string; result: Promise<ExistingPushState> } | undefined;

/** Check and sync an existing subscription. A page load never prompts or replaces it. */
export function initializeBrowserPush(publicKey: string, profileId: string): Promise<ExistingPushState> {
  if (!supportsBrowserPush() || Notification.permission !== "granted") return Promise.resolve("missing");
  if (initialization?.publicKey === publicKey && initialization.profileId === profileId) return initialization.result;
  const result = withSubscriptionLock(async (): Promise<ExistingPushState> => {
    const key = decodeApplicationServerKey(publicKey);
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription || Notification.permission !== "granted") return "missing";
    const compatibility = subscriptionCompatibility(subscription, key);
    if (compatibility !== "incompatible") await syncSubscription(subscription, profileId);
    return compatibility;
  }).finally(() => {
    if (initialization?.result === result) initialization = undefined;
  });
  initialization = { publicKey, profileId, result };
  return result;
}

async function requestPushPermission(): Promise<NotificationPermission> {
  if (Notification.permission !== "default") return Notification.permission;
  requestingPermission = true;
  try {
    return await Notification.requestPermission();
  } finally {
    requestingPermission = false;
  }
}

function requireSubscriptionGesture() {
  if (navigator.userActivation?.isActive === false) {
    throw new Error("Tap again to finish setting up notifications.");
  }
}

/** Call directly from a user action so the browser can prompt or subscribe. */
export async function enableBrowserPush(publicKey: string, profileId: string): Promise<NotificationPermission | "unverifiable"> {
  if (!supportsBrowserPush()) throw new Error("This browser does not support push notifications.");
  const key = decodeApplicationServerKey(publicKey);
  if (busy || requestingPermission) throw new Error("Notification settings are being updated. Please try again.");
  // Request permission before asynchronous registration or cross-tab lock acquisition.
  const permission = await requestPushPermission();
  if (permission !== "granted") return permission;

  return withSubscriptionLock(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/") ??
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const ready = registration.active ? registration : await navigator.serviceWorker.ready;
    if (Notification.permission !== "granted") return Notification.permission;

    const existing = await ready.pushManager.getSubscription();
    if (Notification.permission !== "granted") return Notification.permission;
    if (existing) {
      const compatibility = subscriptionCompatibility(existing, key);
      if (compatibility !== "incompatible") {
        await syncSubscription(existing, profileId);
        if (Notification.permission !== "granted") return Notification.permission;
        return compatibility === "compatible" ? "granted" : "unverifiable";
      }

      requireSubscriptionGesture();
      rememberReplacement(profileId, existing.endpoint);
      try {
        if (!await existing.unsubscribe()) throw new Error("Unsubscribe returned false");
      } catch {
        throw new Error("Could not remove this device’s old push subscription. Tap again to retry.");
      }
    }

    if (Notification.permission !== "granted") return Notification.permission;
    requireSubscriptionGesture();
    let subscription: PushSubscription;
    try {
      subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    } catch {
      // Some browsers require a fresh gesture after the asynchronous unsubscribe.
      throw new Error("Could not create a push subscription. Tap again to finish setting up notifications.");
    }
    if (subscriptionCompatibility(subscription, key) === "incompatible") {
      throw new Error("This device still has an incompatible push subscription. Tap again to retry.");
    }
    if (Notification.permission !== "granted") return Notification.permission;
    await syncSubscription(subscription, profileId);
    return Notification.permission;
  });
}

export function disableBrowserPush(profileId: string): Promise<void> {
  return withSubscriptionLock(() => removeBrowserPush(profileId));
}

async function removeBrowserPush(profileId: string): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const payload = subscriptionPayload(subscription);
  if (payload) {
    const response = await fetch("/api/push/subscription", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: payload.endpoint, profileId }),
    });
    if (!response.ok) throw new Error("Could not update your notification settings. Please try again.");
  }
  if (!await subscription.unsubscribe()) {
    throw new Error("Could not remove this device’s push subscription. Please try again.");
  }
}
