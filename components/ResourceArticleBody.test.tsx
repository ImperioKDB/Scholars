import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleTableOfContents } from "./resource-center-interactions";
import { ResourceArticleBody, extractArticleHeadings, safeHref } from "./ResourceArticleBody";

describe("Resource article content structure", () => {
  it("renders unique IDs for duplicate H2/H3 headings and matching TOC links", () => {
    const content = "## Same heading\nParagraph without a blank line.\n\n### Same heading\n\n## Same heading\n\n### Punctuation: now!\n\n###   ";
    const headings = extractArticleHeadings(content);
    const body = renderToStaticMarkup(<ResourceArticleBody content={content} />);
    const toc = renderToStaticMarkup(<ArticleTableOfContents headings={headings} />);
    const renderedIds = [...body.matchAll(/<(?:h2|h3) id="([^"]+)"/g)].map((match) => match[1]);
    const tocHrefs = [...toc.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);

    expect(renderedIds).toEqual(["same-heading", "same-heading-2", "same-heading-3", "punctuation-now", "section"]);
    expect(new Set(renderedIds).size).toBe(renderedIds.length);
    expect(tocHrefs).toEqual(renderedIds);
    expect(body).toContain("Paragraph without a blank line.");
  });

  it("preserves heading hierarchy and extracts readable punctuation slugs", () => {
    expect(extractArticleHeadings("## **A useful** guide with [links](/resources)\n### Next step?")).toEqual([
      { id: "a-useful-guide-with-links", text: "A useful guide with links", level: 2 },
      { id: "next-step", text: "Next step?", level: 3 },
    ]);
  });

  it("renders consecutive and mixed list/quote blocks with inline emphasis", () => {
    const body = renderToStaticMarkup(<ResourceArticleBody content={"- one\n- **two**\n\n1. first\n2. second\n\n> quoted\n> continued\n\nA *small* paragraph."} />);
    expect(body).toContain("<ul");
    expect(body).toContain("<ol");
    expect(body).toContain("<blockquote");
    expect(body).toContain("<strong>two</strong>");
    expect(body).toContain("<em>small</em>");
  });

  it("allows internal and HTTPS links but rejects unsafe or malformed protocols", () => {
    expect(safeHref("/resources/guide")).toBe("/resources/guide");
    expect(safeHref("https://example.com/guide")).toBe("https://example.com/guide");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,unsafe")).toBeNull();
    expect(safeHref("//example.com/escape")).toBeNull();
    expect(safeHref("not a URL")).toBeNull();
  });
});
