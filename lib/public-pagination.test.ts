import { describe, expect, it } from "vitest";
import { isClosedListing } from "./dates";
import { pageHref, pageStart, parsePublicPage, PUBLIC_PAGE_SIZE } from "./public-pagination";

describe("public pagination", () => {
  it("normalizes invalid pages and creates stable offsets", () => {
    expect(parsePublicPage(undefined)).toBe(1);
    expect(parsePublicPage("0")).toBe(1);
    expect(parsePublicPage("not-a-page")).toBe(1);
    expect(parsePublicPage("3")).toBe(3);
    expect(pageStart(3)).toBe(PUBLIC_PAGE_SIZE * 2);
  });

  it("keeps page one canonical and makes later pages crawlable", () => {
    expect(pageHref("/reviews", 1)).toBe("/reviews");
    expect(pageHref("/reviews", 2)).toBe("/reviews?page=2");
  });
});

describe("public closed listing lifecycle", () => {
  it("marks past deadlines and closed cycles as closed", () => {
    expect(isClosedListing({ deadline: "2020-01-01" })).toBe(true);
    expect(isClosedListing({ last_cycle_closed_at: "2020-01-01" })).toBe(true);
  });

  it("keeps rolling and future listings open", () => {
    expect(isClosedListing({ deadline: null })).toBe(false);
    expect(isClosedListing({ deadline: "2999-01-01" })).toBe(false);
  });
});
