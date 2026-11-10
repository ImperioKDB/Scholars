import { describe, expect, it } from "vitest";
import {
  buildInternalReturnPath,
  buildOpportunityAuthPaths,
  resolveAuthenticatedReturnPath,
} from "./return-destination";

describe("opportunity authentication destinations", () => {
  it("preserves the opportunity path and relevant query parameters", () => {
    const returnPath = buildInternalReturnPath("/opportunity/tech-fellowship", {
      source: "shared",
      tab: ["overview", "deadline"],
      ref: "sharer-id",
      utm_campaign: "launch",
    });

    expect(returnPath).toBe(
      "/opportunity/tech-fellowship?source=shared&tab=overview&tab=deadline"
    );
  });

  it("nests the exact destination through onboarding for both auth choices", () => {
    const { signupPath, loginPath } = buildOpportunityAuthPaths(
      "/opportunity/tech-fellowship?source=shared&tab=deadline"
    );
    const expectedOnboarding =
      "/onboarding?next=%2Fopportunity%2Ftech-fellowship%3Fsource%3Dshared%26tab%3Ddeadline";

    expect(signupPath).toBe(`/signup?next=${encodeURIComponent(expectedOnboarding)}`);
    expect(loginPath).toBe(`/login?next=${encodeURIComponent(expectedOnboarding)}`);
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
  ])("rejects an unsafe destination %s", (unsafePath) => {
    const paths = buildOpportunityAuthPaths(unsafePath);
    expect(paths.signupPath).toBe(
      "/signup?next=%2Fonboarding%3Fnext%3D%252Fdashboard"
    );
    expect(paths.loginPath).toBe(
      "/login?next=%2Fonboarding%3Fnext%3D%252Fdashboard"
    );
  });

  it("keeps the standard dashboard fallback when no return path is supplied", () => {
    expect(buildOpportunityAuthPaths("").signupPath).toBe(
      "/signup?next=%2Fonboarding%3Fnext%3D%252Fdashboard"
    );
  });

  it("sends a completed user directly to the opportunity instead of onboarding", () => {
    expect(
      resolveAuthenticatedReturnPath(
        "/onboarding?next=%2Fopportunity%2Ftech-fellowship%3Fsource%3Dshared",
        100
      )
    ).toBe("/opportunity/tech-fellowship?source=shared");
  });

  it.each([0, 60, undefined, null])(
    "keeps onboarding for incomplete or unknown profile state (%s)",
    (completeness) => {
      const path = "/onboarding?next=%2Fopportunity%2Ftech-fellowship";
      expect(resolveAuthenticatedReturnPath(path, completeness)).toBe(path);
    }
  );

  it("uses the dashboard fallback when the nested target is external", () => {
    expect(
      resolveAuthenticatedReturnPath(
        "/onboarding?next=https%3A%2F%2Fevil.example%2F",
        100
      )
    ).toBe("/dashboard");
  });
});
