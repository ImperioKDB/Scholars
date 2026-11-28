import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableBrowserPush, initializeBrowserPush, subscriptionCompatibility } from "./browser";

const key = Uint8Array.from({ length: 65 }, (_, index) => index === 0 ? 4 : index);
const profileId = "alice";
const publicKey = Buffer.from(key).toString("base64url");
const oldEndpoint = "https://fcm.googleapis.com/old";
const newEndpoint = "https://fcm.googleapis.com/new";
const mismatch = Uint8Array.from(key, (byte, index) => index === 64 ? byte + 1 : byte);

function subscription(endpoint: string, applicationServerKey: ArrayBuffer | null) {
  return {
    endpoint,
    options: { applicationServerKey },
    toJSON: () => ({ endpoint, keys: { p256dh: "public", auth: "auth" } }),
    unsubscribe: vi.fn(async () => true),
  } as unknown as PushSubscription;
}

const getSubscription = vi.fn<() => Promise<PushSubscription | null>>();
const subscribe = vi.fn<PushManager["subscribe"]>();
const fetchMock = vi.fn<typeof fetch>();
const requestPermission = vi.fn();
const notification = { permission: "granted", requestPermission };

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  notification.permission = "granted";
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("navigator", {
    serviceWorker: { getRegistration: async () => ({ active: {}, pushManager: { getSubscription, subscribe } }) },
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  subscribe.mockResolvedValue(subscription(newEndpoint, key.buffer));
});

afterEach(async () => {
  // Complete any pending retry so the in-memory storage fallback is reset.
  notification.permission = "granted";
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  getSubscription.mockResolvedValue(subscription(newEndpoint, key.buffer));
  await initializeBrowserPush(publicKey, profileId);
  vi.unstubAllGlobals();
});

describe("browser push compatibility", () => {
  it("compares all bytes and distinguishes unavailable metadata", () => {
    expect(subscriptionCompatibility(subscription(oldEndpoint, key.buffer), key)).toBe("compatible");
    expect(subscriptionCompatibility(subscription(oldEndpoint, mismatch.buffer), key)).toBe("incompatible");
    expect(subscriptionCompatibility(subscription(oldEndpoint, key.slice(0, 64).buffer), key)).toBe("incompatible");
    expect(subscriptionCompatibility(subscription(oldEndpoint, null), key)).toBe("unverifiable");
    expect(subscriptionCompatibility({} as PushSubscription, key)).toBe("unverifiable");
  });

  it.each([["compatible", key.buffer], ["unverifiable", null]] as const)(
    "preserves and syncs a %s subscription",
    async (state, bytes) => {
      const existing = subscription(oldEndpoint, bytes);
      getSubscription.mockResolvedValue(existing);
      await expect(initializeBrowserPush(publicKey, profileId)).resolves.toBe(state);
      await expect(enableBrowserPush(publicKey, profileId)).resolves.toBe(state === "compatible" ? "granted" : "unverifiable");
      expect(existing.unsubscribe).not.toHaveBeenCalled();
      expect(subscribe).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("does nothing when permission is revoked", async () => {
    notification.permission = "denied";
    await expect(initializeBrowserPush(publicKey, profileId)).resolves.toBe("missing");
    await expect(enableBrowserPush(publicKey, profileId)).resolves.toBe("denied");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(getSubscription).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing in unsupported browsers", async () => {
    vi.stubGlobal("navigator", {});
    await expect(initializeBrowserPush(publicKey, profileId)).resolves.toBe("missing");
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("does not support");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistration: async () => ({ active: {}, pushManager: { getSubscription, subscribe } }) },
    });
  });

  it("waits for an explicit action to renew and submits only the replaced endpoint", async () => {
    const existing = subscription(oldEndpoint, mismatch.buffer);
    getSubscription.mockResolvedValue(existing);
    await expect(initializeBrowserPush(publicKey, profileId)).resolves.toBe("incompatible");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(existing.unsubscribe).not.toHaveBeenCalled();
    await expect(enableBrowserPush(publicKey, profileId)).resolves.toBe("granted");
    expect(existing.unsubscribe).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: key });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      endpoint: newEndpoint, replacedEndpoint: oldEndpoint,
    });
  });

  it("keeps the old server record if unsubscribe fails", async () => {
    const existing = subscription(oldEndpoint, mismatch.buffer);
    vi.mocked(existing.unsubscribe).mockResolvedValue(false);
    getSubscription.mockResolvedValue(existing);
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("Could not remove");
    expect(subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires another click if activation expires after unsubscribe", async () => {
    const activation = { isActive: true };
    Object.defineProperty(navigator, "userActivation", { value: activation });
    const existing = subscription(oldEndpoint, mismatch.buffer);
    vi.mocked(existing.unsubscribe).mockImplementation(async () => {
      activation.isActive = false;
      return true;
    });
    getSubscription.mockResolvedValueOnce(existing).mockResolvedValue(null);
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("Tap again");
    expect(subscribe).not.toHaveBeenCalled();
    activation.isActive = true;
    await expect(enableBrowserPush(publicKey, profileId)).resolves.toBe("granted");
  });

  it("does not renew when another tab is updating the subscription", async () => {
    const request = vi.fn((_name, _options, callback) => callback(null));
    Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("being updated");
    expect(getSubscription).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith("scholars:web-push", { ifAvailable: true }, expect.any(Function));
    delete (navigator as { locks?: LockManager }).locks;
  });

  it("recovers from a failed subscribe on a later user action", async () => {
    getSubscription.mockResolvedValueOnce(subscription(oldEndpoint, mismatch.buffer)).mockResolvedValue(null);
    subscribe.mockRejectedValueOnce(new Error("User activation required"));
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("Tap again");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(enableBrowserPush(publicKey, profileId)).resolves.toBe("granted");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      endpoint: newEndpoint, replacedEndpoint: oldEndpoint,
    });
  });

  it("retries failed synchronization without throwing away the replacement", async () => {
    const replacement = subscription(newEndpoint, key.buffer);
    getSubscription.mockResolvedValueOnce(subscription(oldEndpoint, mismatch.buffer)).mockResolvedValue(replacement);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("Could not save");
    await expect(initializeBrowserPush(publicKey, profileId)).resolves.toBe("compatible");
    expect(subscribe).toHaveBeenCalledOnce();
    expect(replacement.unsubscribe).not.toHaveBeenCalled();
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).replacedEndpoint).toBe(oldEndpoint);
  });

  it("keeps a pending replacement scoped to its initiating account", async () => {
    getSubscription.mockResolvedValueOnce(subscription(oldEndpoint, mismatch.buffer))
      .mockResolvedValue(subscription(newEndpoint, key.buffer));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("Could not save");
    await expect(initializeBrowserPush(publicKey, "bob")).resolves.toBe("compatible");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ profileId: "bob" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).not.toHaveProperty("replacedEndpoint");
    await expect(initializeBrowserPush(publicKey, profileId)).resolves.toBe("compatible");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      profileId, replacedEndpoint: oldEndpoint,
    });
  });

  it("shares concurrent initialization and excludes competing renewal", async () => {
    getSubscription.mockResolvedValue(subscription(oldEndpoint, key.buffer));
    const first = initializeBrowserPush(publicKey, profileId);
    expect(initializeBrowserPush(publicKey, profileId)).toBe(first);
    await expect(enableBrowserPush(publicKey, profileId)).rejects.toThrow("being updated");
    await expect(first).resolves.toBe("compatible");
    expect(getSubscription).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
