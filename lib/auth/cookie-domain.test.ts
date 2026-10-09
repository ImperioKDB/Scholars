import { describe, expect, it } from "vitest";
import { getAuthCookieDomain } from "./cookie-domain";

describe("getAuthCookieDomain", () => {
  it("shares auth cookies across the Scholars apex and canonical www host", () => {
    expect(getAuthCookieDomain("scholars.com.ng")).toBe(".scholars.com.ng");
    expect(getAuthCookieDomain("www.scholars.com.ng")).toBe(".scholars.com.ng");
  });

  it("does not share auth cookies with preview or unrelated hosts", () => {
    expect(getAuthCookieDomain("scholars-git-main.vercel.app")).toBeUndefined();
    expect(getAuthCookieDomain("evil-scholars.com.ng")).toBeUndefined();
    expect(getAuthCookieDomain("localhost")).toBeUndefined();
  });
});
