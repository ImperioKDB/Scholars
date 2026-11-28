import { describe, expect, it, vi } from "vitest";
import { daysUntil, formatApplicationWindowLabel, isClosedListing, todayLagosIso } from "./dates";

describe("formatApplicationWindowLabel", () => {
  it("shows weekdays and both dates for a same-year application window", () => {
    expect(formatApplicationWindowLabel("2026-11-23", "2026-11-25")).toBe(
      "Applications open Monday, 23 Nov – Wednesday, 25 Nov 2026",
    );
  });

  it("includes both years when the window crosses a calendar year", () => {
    expect(formatApplicationWindowLabel("2026-12-31", "2027-01-03")).toBe(
      "Applications open Thursday, 31 Dec 2026 – Sunday, 3 Jan 2027",
    );
  });
});

it("counts date-only deadlines through midnight in Lagos", () => {
  const deadline = "2026-11-30";
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-11-30T22:59:59Z"));
    expect(daysUntil(deadline)).toBe(0);
    expect(isClosedListing({ deadline })).toBe(false);
    vi.setSystemTime(new Date("2026-11-30T23:00:00Z"));
    expect(todayLagosIso()).toBe("2026-12-01");
    expect(daysUntil(deadline)).toBe(-1);
    expect(isClosedListing({ deadline })).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
