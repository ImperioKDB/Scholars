import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NotificationBell } from "@/components/NotificationBell";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/LogoLoader", () => ({
  LogoLoader: () => <div>Loading notifications</div>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const notification = {
  id: "notification-1",
  type: "discussion_reply",
  message: "Someone replied to your discussion.",
  created_at: "2026-11-25T10:00:00.000Z",
  read_at: null,
  scholarship_id: null,
  discussion_id: null,
};

function getResponse(
  body: Record<string, unknown>,
  ok = true,
) {
  return {
    ok,
    json: async () => body,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("NotificationBell polling and read state", () => {
  it("does not poll while the document is hidden and refreshes when visible", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    const fetchMock = vi.fn().mockResolvedValue(
      getResponse({
        notifications: [],
        unreadCount: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);

    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("coalesces overlapping focus and visibility refresh events", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    let resolveRequest!: (value: unknown) => void;
    const pendingRequest = new Promise((resolve) => {
      resolveRequest = resolve;
    });

    const fetchMock = vi.fn(() => pendingRequest);
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest(
        getResponse({
          notifications: [],
          unreadCount: 0,
        }),
      );
      await pendingRequest;
    });
  });

  it("preserves unread state when mark-all-read PATCH fails", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") {
        return getResponse({}, false);
      }

      return getResponse({
        notifications: [notification],
        unreadCount: 1,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const trigger = await screen.findByRole("button", {
      name: "1 unread notifications",
    });

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([, options]) => options?.method === "PATCH",
        ),
      ).toBe(true);
    });

    // A failed PATCH must not make the UI claim the notification is read.
    expect(
      screen.getByRole("button", {
        name: "1 unread notifications",
      }),
    ).toBeTruthy();

    expect(screen.getByText("1 new")).toBeTruthy();
    expect(
      await screen.findByRole("alert"),
    ).toBeTruthy();
  });

  it("clears unread state and marks displayed notifications as read after a successful PATCH", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    let getCount = 0;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return getResponse({});
      getCount += 1;
      return getResponse(
        getCount >= 3
          ? {
              notifications: [{ ...notification, read_at: "2026-11-25T12:00:00.000Z" }],
              unreadCount: 0,
            }
          : { notifications: [notification], unreadCount: 1 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    const trigger = await screen.findByRole("button", {
      name: "1 unread notifications",
    });

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    });
    expect(screen.getByText(notification.message)).toBeTruthy();
    expect(screen.getByText("0 new")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH"),
    ).toHaveLength(1);
  });

  it("retries mark-all-read from Try again after the first PATCH fails", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    let patchAttempts = 0;
    let getCount = 0;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") {
        patchAttempts += 1;
        return getResponse({}, patchAttempts > 1);
      }
      getCount += 1;
      return getResponse(
        getCount >= 4
          ? {
              notifications: [{ ...notification, read_at: "2026-11-25T12:00:00.000Z" }],
              unreadCount: 0,
            }
          : { notifications: [notification], unreadCount: 1 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    fireEvent.click(
      await screen.findByRole("button", { name: "1 unread notifications" }),
    );

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(patchAttempts).toBe(2);
      expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    });
    expect(screen.getByText("0 new")).toBeTruthy();
  });

  it("does not send PATCH when the panel closes while its initial GET is pending", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const pendingGet = deferred<unknown>();
    const fetchMock = vi.fn(
      (_url: string, _options?: RequestInit) => pendingGet.promise,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Close notifications" }));

    await act(async () => {
      pendingGet.resolve(
        getResponse({ notifications: [notification], unreadCount: 1 }),
      );
      await pendingGet.promise;
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH"),
    ).toBe(false);
  });

  it("does not send PATCH when the component unmounts while its initial GET is pending", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const pendingGet = deferred<unknown>();
    const fetchMock = vi.fn(
      (_url: string, _options?: RequestInit) => pendingGet.promise,
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<NotificationBell />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    unmount();

    await act(async () => {
      pendingGet.resolve(
        getResponse({ notifications: [notification], unreadCount: 1 }),
      );
      await pendingGet.promise;
    });

    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH"),
    ).toBe(false);
  });

  it("does not update state after unmount while PATCH is pending", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const pendingPatch = deferred<unknown>();
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return pendingPatch.promise;
      return getResponse({ notifications: [notification], unreadCount: 1 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(<NotificationBell />);
    fireEvent.click(
      await screen.findByRole("button", { name: "1 unread notifications" }),
    );
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH"),
      ).toBe(true);
    });
    unmount();

    await act(async () => {
      pendingPatch.resolve(getResponse({}));
      await pendingPatch.promise;
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("reconciles the currently active panel after a shared PATCH succeeds", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const pendingPatch = deferred<unknown>();
    let getCount = 0;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return pendingPatch.promise;
      getCount += 1;
      return getResponse(
        getCount >= 4
          ? { notifications: [], unreadCount: 0 }
          : { notifications: [notification], unreadCount: 1 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    fireEvent.click(
      await screen.findByRole("button", { name: "1 unread notifications" }),
    );
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH"),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Close notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "1 unread notifications" }));

    await act(async () => {
      pendingPatch.resolve(getResponse({}));
      await pendingPatch.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
      expect(screen.getByText("0 new")).toBeTruthy();
    });
    expect(
      fetchMock.mock.calls.filter(([, options]) => !options?.method),
    ).toHaveLength(4);
  });

  it("shows a shared PATCH failure in the currently active panel", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const pendingPatch = deferred<unknown>();
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return pendingPatch.promise;
      return getResponse({ notifications: [notification], unreadCount: 1 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    fireEvent.click(
      await screen.findByRole("button", { name: "1 unread notifications" }),
    );
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH"),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Close notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "1 unread notifications" }));

    await act(async () => {
      pendingPatch.resolve(getResponse({}, false));
      await pendingPatch.promise;
    });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByText("1 new")).toBeTruthy();
  });

  it("keeps a notification created during PATCH unread after authoritative reconciliation", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const pendingPatch = deferred<unknown>();
    let getCount = 0;
    const newNotification = {
      ...notification,
      id: "notification-2",
      message: "A newer notification arrived.",
      read_at: null,
    };
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return pendingPatch.promise;
      getCount += 1;
      return getResponse(
        getCount >= 3
          ? {
              notifications: [
                { ...notification, read_at: "2026-11-25T12:00:00.000Z" },
                newNotification,
              ],
              unreadCount: 1,
            }
          : { notifications: [notification], unreadCount: 1 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    fireEvent.click(
      await screen.findByRole("button", { name: "1 unread notifications" }),
    );
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH"),
      ).toBe(true);
    });

    await act(async () => {
      pendingPatch.resolve(getResponse({}));
      await pendingPatch.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "1 unread notifications" })).toBeTruthy();
      expect(screen.getByText(newNotification.message)).toBeTruthy();
    });
    expect(screen.getByText("1 new")).toBeTruthy();
  });

  it("does not let a stale GET restore unread state after mark-all-read succeeds", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const staleGet = deferred<unknown>();
    const patch = deferred<unknown>();
    let getCount = 0;
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return patch.promise;
      getCount += 1;
      if (getCount === 1 || getCount === 2) {
        return getResponse({ notifications: [notification], unreadCount: 1 });
      }
      if (getCount === 3) return staleGet.promise;
      return getResponse({ notifications: [], unreadCount: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    fireEvent.click(
      await screen.findByRole("button", { name: "1 unread notifications" }),
    );
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH"),
      ).toBe(true);
    });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(getCount).toBe(3));

    await act(async () => {
      patch.resolve(getResponse({}));
      await patch.promise;
    });
    await act(async () => {
      staleGet.resolve(
        getResponse({ notifications: [notification], unreadCount: 1 }),
      );
      await staleGet.promise;
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    });
    expect(screen.queryByText("1 new")).toBeNull();
  });

  it("does not let an invalidated GET cause a duplicate PATCH after reopening", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const pendingGet = deferred<unknown>();
    let patchAttempts = 0;
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") {
        patchAttempts += 1;
        return Promise.resolve(getResponse({}));
      }
      return pendingGet.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Close notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    await act(async () => {
      pendingGet.resolve(
        getResponse({ notifications: [notification], unreadCount: 1 }),
      );
      await pendingGet.promise;
    });
    await waitFor(() => expect(patchAttempts).toBe(1));
  });

  it("refreshes every 60 seconds only while the document is visible", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      getResponse({ notifications: [], unreadCount: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
