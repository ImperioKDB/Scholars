import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("./supabase/server", () => ({
  createClient: () => ({
    from: mockFrom,
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/resource-center/featured/guide.webp" } }),
      }),
    },
  }),
}));

import { getResourceCanonicalUrl, getResourceCategory, getResourceImageUrl, isApprovedResourceImagePath, ResourceDataError, RESOURCE_PAGE_SIZE } from "./resource-center";

const category = { id: "cat-1", slug: "guides", name: "Guides", description: null, display_order: 1 };
const card = (id: string) => ({ id, slug: `guide-${id}`, title: `Guide ${id}`, excerpt: null, article_type: "Guide", published_at: `2026-01-${String((Number(id.replace(/\D/g, "")) % 28) + 1).padStart(2, "0")}T00:00:00.000Z`, reading_time_minutes: 5, author_name: "Scholars", featured_image_path: null });

function configureCategoryData(articleCount: number, failingTable?: string) {
  const ids = Array.from({ length: articleCount }, (_, index) => `article-${index + 1}`);
  mockFrom.mockImplementation((table: string) => {
    if (!table) return { getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })) };
    if (failingTable && table === failingTable) throw new Error("network unavailable");
    if (table === "resource_public_categories") {
      const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn(async () => ({ data: category, error: null })) };
      return chain;
    }
    if (table === "resource_public_article_categories") {
      return {
        select: vi.fn((_fields: string, options?: { head?: boolean }) => {
          if (options?.head) return { eq: vi.fn(async () => ({ count: articleCount, error: null })) };
          const chain = { eq: vi.fn(() => chain), order: vi.fn(() => chain), range: vi.fn(async (from: number, to: number) => ({ data: ids.slice(from, to + 1).map((article_id) => ({ article_id })), error: null })) };
          return chain;
        }),
      };
    }
    if (table === "resource_public_articles") {
      return { select: vi.fn(() => ({ in: vi.fn((field: string, requestedIds: string[]) => ({ limit: vi.fn(async () => ({ data: requestedIds.map(card), error: null })) })) })) };
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

describe("Resource Center public data contract", () => {
  beforeEach(() => mockFrom.mockReset());

  it("accepts only approved featured-image paths", () => {
    expect(isApprovedResourceImagePath("resource-center/featured/guide.webp")).toBe(true);
    expect(isApprovedResourceImagePath("resource-center/featured/../guide.webp")).toBe(false);
    expect(isApprovedResourceImagePath("resource-center/featured\\guide.webp")).toBe(false);
    expect(isApprovedResourceImagePath("https://example.com/guide.webp")).toBe(false);
    expect(isApprovedResourceImagePath(null)).toBe(false);
  });

  it("normalizes only the exact approved article canonical route", () => {
    const expected = "https://www.scholars.com.ng/resources/study-guide";
    const cases: Array<[string | null, string]> = [
      [expected, expected],
      ["https://www.scholars.com.ng/resources/study-guide/", expected],
      ["https://example.com/resources/study-guide", expected],
      ["http://www.scholars.com.ng/resources/study-guide", expected],
      ["https://www.scholars.com.ng/about", expected],
      ["https://www.scholars.com.ng/resources/another-guide", expected],
      ["https://www.scholars.com.ng/resources/study-guide?x=1", expected],
      ["https://www.scholars.com.ng/resources/study-guide#part", expected],
      ["//www.scholars.com.ng/resources/study-guide", expected],
      ["not a URL", expected],
      [null, expected],
    ];
    for (const [stored, result] of cases) expect(getResourceCanonicalUrl("study-guide", stored)).toBe(result);
  });

  it.each([0, 1, RESOURCE_PAGE_SIZE, RESOURCE_PAGE_SIZE + 1])("returns an accurate category count for %i eligible articles", async (articleCount) => {
    configureCategoryData(articleCount);
    const result = await getResourceCategory("guides");
    expect(result?.totalCount).toBe(articleCount);
    expect(result?.articles).toHaveLength(articleCount);
  });

  it("paginates category links beyond one bounded page without duplicates", async () => {
    configureCategoryData(RESOURCE_PAGE_SIZE + 1);
    const result = await getResourceCategory("guides");
    expect(result?.articles.map((article) => article.id)).toHaveLength(RESOURCE_PAGE_SIZE + 1);
    expect(new Set(result?.articles.map((article) => article.id)).size).toBe(RESOURCE_PAGE_SIZE + 1);
  });

  it("fails closed when a category projection query fails", async () => {
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn(async () => ({ data: null, error: new Error("network unavailable") })) };
    mockFrom.mockReturnValue(chain);
    await expect(getResourceCategory("guides")).rejects.toBeInstanceOf(ResourceDataError);
  });

  it("keeps public projection reads separate from private base tables", async () => {
    configureCategoryData(1);
    await getResourceCategory("guides");
    expect(mockFrom.mock.calls.map(([table]) => table)).not.toContain("resource_articles");
    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual(expect.arrayContaining(["resource_public_categories", "resource_public_article_categories", "resource_public_articles"]));
  });

  describe("getResourceImageUrl Supabase config fallback", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    afterEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    });

    it("returns null when public Supabase config is absent", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(getResourceImageUrl("resource-center/featured/guide.webp")).toBeNull();
    });

    it("returns a public URL when config is present and path is approved", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
      const url = getResourceImageUrl("resource-center/featured/guide.webp");
      expect(url).toBe("https://example.supabase.co/storage/v1/object/public/resource-center/featured/guide.webp");
    });

    it("returns null for unapproved paths even when config is present", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
      expect(getResourceImageUrl("../../../etc/passwd")).toBeNull();
      expect(getResourceImageUrl(null)).toBeNull();
    });
  });
});
