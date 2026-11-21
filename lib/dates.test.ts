import { describe, expect, it } from "vitest";
import { formatApplicationWindowLabel } from "./dates";

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
