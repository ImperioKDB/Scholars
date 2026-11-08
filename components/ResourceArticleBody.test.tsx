import { describe, expect, it } from "vitest";
import { extractArticleHeadings } from "./ResourceArticleBody";

describe("Resource article content structure", () => {
  it("extracts stable heading IDs for the table of contents", () => {
    expect(extractArticleHeadings("## First steps\n\n### First steps\n\n## First steps")).toEqual([
      { id: "first-steps", text: "First steps", level: 2 },
      { id: "first-steps-2", text: "First steps", level: 3 },
      { id: "first-steps-3", text: "First steps", level: 2 },
    ]);
  });

  it("removes formatting markers from heading labels", () => {
    expect(extractArticleHeadings("## **A useful** guide with [links](/resources)")).toEqual([
      { id: "a-useful-guide-with-links", text: "A useful guide with links", level: 2 },
    ]);
  });
});
