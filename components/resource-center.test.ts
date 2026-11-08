import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Resource Center image contract", () => {
  it("uses eager/high priority loading for featured placements and lazy loading otherwise", () => {
    const source = readFileSync(new URL("./resource-center.tsx", import.meta.url), "utf8");
    expect(source).toContain('loading={priority ? "eager" : "lazy"}');
    expect(source).toContain('fetchPriority={priority ? "high" : "auto"}');
    expect(source).toContain("priority className=\"min-h-56");
  });

  it("keeps missing-image fallback and safe path resolution in the shared component contract", () => {
    const source = readFileSync(new URL("./resource-center.tsx", import.meta.url), "utf8");
    expect(source).toContain("if (!src)");
    expect(source).toContain("aria-hidden=\"true\"");
    expect(source).toContain("getResourceImageUrl(path)");
  });
});
