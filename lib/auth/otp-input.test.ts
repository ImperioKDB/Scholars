import { describe, expect, it } from "vitest";
import { distributeOtpInput } from "./otp-input";

describe("distributeOtpInput", () => {
  it("distributes a pasted six-digit code across the six fields", () => {
    expect(distributeOtpInput(["", "", "", "", "", ""], 0, "123456"))
      .toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("supports a multi-digit mobile autofill value starting in another field", () => {
    expect(distributeOtpInput(["9", "", "", "", "", ""], 1, "23456"))
      .toEqual(["9", "2", "3", "4", "5", "6"]);
  });

  it("ignores non-digits and clears a field when no digit remains", () => {
    expect(distributeOtpInput(["1", "2", "3", "", "", ""], 3, "abc"))
      .toEqual(["1", "2", "3", "", "", ""]);
    expect(distributeOtpInput(["1", "2", "3", "", "", ""], 1, "4x5"))
      .toEqual(["1", "4", "5", "", "", ""]);
  });
});
