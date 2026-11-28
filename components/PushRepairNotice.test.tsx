import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { enableBrowserPush, hasIncompatibleBrowserPush } from "@/lib/push/browser";
import { PushRepairNotice } from "./PushRepairNotice";

vi.mock("@/lib/push/browser", () => ({
  enableBrowserPush: vi.fn(),
  hasIncompatibleBrowserPush: vi.fn(),
}));

const props = { publicKey: "public-key", profileId: "returning-user" };
const permission = { permission: "granted" };

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  permission.permission = "granted";
  vi.stubGlobal("Notification", permission);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("checks for repair without starting renewal and remembers dismissal across remounts", async () => {
  vi.mocked(hasIncompatibleBrowserPush).mockResolvedValue(true);
  const { unmount } = render(<PushRepairNotice {...props} />);
  await screen.findByRole("button", { name: "Repair push notifications" });
  expect(enableBrowserPush).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  unmount();
  render(<PushRepairNotice {...props} />);
  expect(screen.queryByRole("region")).toBeNull();
  expect(hasIncompatibleBrowserPush).toHaveBeenCalledOnce();
});

it("renews only on click and reports unavailable metadata without claiming success", async () => {
  vi.mocked(hasIncompatibleBrowserPush).mockResolvedValue(true);
  vi.mocked(enableBrowserPush).mockResolvedValue("unverifiable");
  fireEvent.click(await renderNotice());
  expect(enableBrowserPush).toHaveBeenCalledWith(props.publicKey, props.profileId);
  expect((await screen.findByRole("status")).textContent).toContain("cannot verify");
  expect(screen.queryByText("Push notifications are on for this device.")).toBeNull();
});

it("does not request renewal after permission stops being granted", async () => {
  vi.mocked(hasIncompatibleBrowserPush).mockResolvedValue(true);
  const button = await renderNotice();
  permission.permission = "default";
  fireEvent.click(button);
  expect(enableBrowserPush).not.toHaveBeenCalled();
  expect((await screen.findByRole("status")).textContent).toContain("site settings");
});

function renderNotice() {
  render(<PushRepairNotice {...props} />);
  return screen.findByRole("button", { name: "Repair push notifications" });
}
