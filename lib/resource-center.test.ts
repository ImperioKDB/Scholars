import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("./supabase/server", () => ({
  createClient: () => ({ from: mockFrom }),
}));

import {
  getResourceCanonicalUrl,
  getResourceCategory,
  isApprovedResourceImagePath,
  ResourceDataError,
} from "./resource-center";

describe("Resource Center public data contract", () => {
  beforeEach(() => mockFrom.mockReset());

  it("accepts only the approved featured-image prefix and rejects traversal or remote URLs", () => {
    expect(isApprovedResourceImagePath("resource-center/featured/guide.webp")).toBe(true);
    expect(isApprovedResourceImagePath("resource-center/featured/../guide.webp")).toBe(false);
    expect(isApprovedResourceImagePath("resource-center/featured\\guide.webp")).toBe(false);
    expect(isApprovedResourceImagePath("https://example.com/guide.webp")).toBe(false);
    expect(isApprovedResourceImagePath(null)).toBe(false);
  });

  it("keeps malformed or external stored canonicals on the Scholars-owned route", () => {
    expect(getResourceCanonicalUrl("study-guide", "https://www.scholars.com.ng/resources/study-guide")).toBe("https://www.scholars.com.ng/resources/study-guide");
    expect(getResourceCanonicalUrl("study-guide", "https://example.com/elsewhere")).toBe("https://www.scholars.com.ng/resources/study-guide");
    expect(getResourceCanonicalUrl("study-guide", "not a URL")).toBe("https://www.scholars.com.ng/resources/study-guide");
  });

  it("reads category and eligible article IDs only through public projection names", async () => {
    const categoryChain = {
      select: vi.fn(() => categoryChain),
      eq: vi.fn(() => categoryChain),
      maybeSingle: vi.fn(async () => ({ data: { id: "cat-1", slug: "guides", name: "Guides", description: null, display_order: 1 }, error: null })),
    };
    const linksChain = {
      select: vi.fn(() => linksChain),
      eq: vi.fn(() => linksChain),
      limit: vi.fn(async () => ({ data: [{ article_id: "article-1" }], error: null })),
    };
    const articleChain = {
      select: vi.fn(() => articleChain),
      in: vi.fn(() => articleChain),
      order: vi.fn(() => articleChain),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    mockFrom.mockImplementation((table: string) => table === "resource_public_categories" ? categoryChain : table === "resource_public_article_categories" ? linksChain : articleChain);

    const result = await getResourceCategory("guides");

    expect(result?.category.slug).toBe("guides");
    expect(mockFrom).toHaveBeenCalledWith("resource_public_categories");
    expect(mockFrom).toHaveBeenCalledWith("resource_public_article_categories");
    expect(mockFrom).toHaveBeenCalledWith("resource_public_articles");
  });

  it("surfaces a public read failure instead of turning it into an empty category", async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: null, error: new Error("network unavailable") })),
    };
    mockFrom.mockReturnValue(chain);
    await expect(getResourceCategory("guides")).rejects.toBeInstanceOf(ResourceDataError);
    await expect(getResourceCategory("guides")).rejects.toThrow("Unable to load this resource category");
  });
});
