import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Resource Center homepage navigation", () => {
  it("does not include a circular View all link to the homepage itself", () => {
    const source = readFileSync(path.join(process.cwd(), "app/resources/page.tsx"), "utf8");
    expect(source).not.toContain("View all");
  });
});
