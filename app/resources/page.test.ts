import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Resource Center homepage navigation", () => {
  it("does not include a circular View all link to the homepage itself", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("View all");
  });
});
