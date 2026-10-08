import { describe, expect, it } from "vitest";
import { eligiblePrompts, nextPrompt } from "./onboarding-prompts";

const base = {
  pwaInstalled: false,
  pushEnableClicked: false,
  canInstall: true,
  canPush: true,
  notificationPermission: "default" as NotificationPermission,
  hasSubscription: false,
  isAdmin: false,
};

describe("online onboarding prompt eligibility", () => {
  it("sequences install before push when both are eligible", () => {
    expect(eligiblePrompts(base)).toEqual(["install", "push"]);
    expect(nextPrompt(base)).toBe("install");
  });

  it("shows push only after the account has installed", () => {
    expect(eligiblePrompts({ ...base, pwaInstalled: true })).toEqual(["push"]);
  });

  it("shows install only after Enable notifications was clicked", () => {
    expect(eligiblePrompts({ ...base, pushEnableClicked: true })).toEqual(["install"]);
  });

  it("shows neither when both account actions are recorded", () => {
    expect(eligiblePrompts({ ...base, pwaInstalled: true, pushEnableClicked: true })).toEqual([]);
  });

  it("skips impossible browser actions", () => {
    expect(eligiblePrompts({ ...base, canInstall: false })).toEqual(["push"]);
    expect(eligiblePrompts({ ...base, canPush: false })).toEqual(["install"]);
    expect(eligiblePrompts({ ...base, notificationPermission: "denied" })).toEqual(["install"]);
    expect(eligiblePrompts({ ...base, hasSubscription: true })).toEqual(["install"]);
    expect(eligiblePrompts({ ...base, isAdmin: true })).toEqual(["install"]);
  });
});
