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
});
