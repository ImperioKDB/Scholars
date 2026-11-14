import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Resource Center homepage navigation", () => {
  it("does not include a circular View all link to the homepage itself", () => {
    const source = readFileSync(path.join(process.cwd(), "app/resources/page.tsx"), "utf8");
    expect(source).not.toContain("View all");
  });

  it("does not duplicate the | Scholars brand suffix in the page title", () => {
    const source = readFileSync(path.join(process.cwd(), "app/resources/page.tsx"), "utf8");
    const titleMatch = source.match(/title:\s*"([^"]*)"/);
    expect(titleMatch).not.toBeNull();
    const title = titleMatch![1];
    expect(title).not.toContain("| Scholars");
    expect(title).toBe("Resource Center for students");

    const ogTitleMatch = source.match(/openGraph:\s*\{\s*title:\s*"([^"]*)"/);
    if (ogTitleMatch) {
      const ogTitle = ogTitleMatch[1];
      expect(ogTitle).not.toContain(" | Scholars | Scholars");
      expect(ogTitle).toContain(" | Scholars");
    }
  });

  it("excludes categories with no published articles from visibleCategories", () => {
    const source = readFileSync(path.join(process.cwd(), "app/resources/page.tsx"), "utf8");
    expect(source).toContain("getLocalResourceArticlesForCategory");
    expect(source).toContain("localArticles.length > 0");
  });

  it("updates hero copy to reflect all six content pillars", () => {
    const source = readFileSync(path.join(process.cwd(), "app/resources/page.tsx"), "utf8");
    expect(source).toContain("academic development");
    expect(source).toContain("student life");
    expect(source).toContain("educational systems");
  });
});
