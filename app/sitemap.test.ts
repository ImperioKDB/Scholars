import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: mockFrom }),
}));

import sitemap from "./sitemap";

const BASE = "https://www.scholars.com.ng";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

function setPublicConfig(enabled: boolean) {
  if (enabled) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
}

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  mockFrom.mockReset();
});

type CatalogRow = {
  slug: string | null;
  published_at?: string | null;
};

function makeChain(rows: CatalogRow[], error?: Error) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(async (from: number, to: number) => {
      if (error) return { data: null, error };
      const batchIndex = from / 500;
      return { data: rows.slice(batchIndex * 500, (batchIndex + 1) * 500), error: null };
    }),
  };
  return chain;
}

function makeEmptyChain() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(async () => ({ data: [], error: null })),
  };
  return chain;
}

function buildAllChains(
  scholarships: CatalogRow[],
  opportunities: CatalogRow[],
  articles: CatalogRow[],
  categories: CatalogRow[],
) {
  mockFrom.mockImplementation((requestedTable: string) => {
    if (requestedTable === "scholarships_public_preview_v1") return makeChain(scholarships);
    if (requestedTable === "opportunities_public_preview_v1") return makeChain(opportunities);
    if (requestedTable === "resource_public_articles") return makeChain(articles);
    if (requestedTable === "resource_public_article_categories") return makeChain(categories);
    return makeEmptyChain();
  });
}

function buildErrorChain(errorTable: string) {
  mockFrom.mockImplementation((requestedTable: string) => {
    if (requestedTable === errorTable) return makeChain([], new Error("network unavailable"));
    return makeEmptyChain();
  });
}

describe("sitemap route", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_APP_URL = BASE;
  });

  it("includes /resources in the sitemap", async () => {
    buildAllChains([], [], [], []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);
    expect(urls).toContain(`${BASE}/resources`);
  });

  it("includes all six local resource category routes", async () => {
    buildAllChains([], [], [], []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    const expectedCategories = [
      "scholarship-applications",
      "essays-and-letters",
      "interviews-and-tests",
      "study-abroad-and-funding",
      "study-techniques",
      "scam-awareness",
    ];
    for (const category of expectedCategories) {
      expect(urls).toContain(`${BASE}/resources/category/${category}`);
    }
  });

  it("includes local articles without Supabase configuration", async () => {
    setPublicConfig(false);
    buildAllChains([], [], [], []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain(`${BASE}/resources/how-to-find-legitimate-scholarships`);
    expect(urls).toContain(`${BASE}/resources/how-to-write-a-scholarship-motivation-letter`);
  });

  it("merges database articles with local articles without duplicate slugs", async () => {
    const dbArticles: CatalogRow[] = [
      { slug: "how-to-find-legitimate-scholarships", published_at: "2026-01-01T00:00:00.000Z" },
      { slug: "new-db-article", published_at: "2026-02-01T00:00:00.000Z" },
    ];
    buildAllChains([], [], dbArticles, []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain(`${BASE}/resources/new-db-article`);
    const duplicates = urls.filter((url) => url === `${BASE}/resources/how-to-find-legitimate-scholarships`);
    expect(duplicates.length).toBe(1);
  });

  it("keeps local articles available when the resource query fails", async () => {
    buildAllChains([], [], [], []);
    buildErrorChain("resource_public_articles");

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain(`${BASE}/resources/how-to-find-legitimate-scholarships`);
  });

  it("keeps local categories available when the category query fails", async () => {
    buildAllChains([], [], [], []);
    buildErrorChain("resource_public_article_categories");

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain(`${BASE}/resources/category/scholarship-applications`);
    expect(urls).toContain(`${BASE}/resources/category/scam-awareness`);
  });

  it("scholarship and opportunity queries use only their approved public views", async () => {
    const viewedTables: string[] = [];
    mockFrom.mockImplementation((requestedTable: string) => {
      viewedTables.push(requestedTable);
      return makeEmptyChain();
    });

    await sitemap();

    expect(viewedTables).toContain("scholarships_public_preview_v1");
    expect(viewedTables).toContain("opportunities_public_preview_v1");
    expect(viewedTables).not.toContain("scholarships");
    expect(viewedTables).not.toContain("opportunities");
  });

  it("scholarship query failure rejects (no silent incomplete sitemap)", async () => {
    buildErrorChain("scholarships_public_preview_v1");

    await expect(sitemap()).rejects.toThrow(
      "Unable to build sitemap from public scholarships_public_preview_v1",
    );
  });

  it("opportunity query failure rejects (no silent incomplete sitemap)", async () => {
    buildErrorChain("opportunities_public_preview_v1");

    await expect(sitemap()).rejects.toThrow(
      "Unable to build sitemap from public opportunities_public_preview_v1",
    );
  });

  it("empty catalogues remain valid", async () => {
    buildAllChains([], [], [], []);

    const result = await sitemap();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("closed and postgraduate scholarship pages remain discoverable", async () => {
    const scholarships: CatalogRow[] = [
      { slug: "closed-scholarship" },
      { slug: "postgraduate-scholarship" },
      { slug: null },
    ];
    buildAllChains(scholarships, [], [], []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain(`${BASE}/scholarship/closed-scholarship`);
    expect(urls).toContain(`${BASE}/scholarship/postgraduate-scholarship`);
    expect(urls).not.toContain(`${BASE}/scholarship/null`);
  });

  it("pagination across more than 500 records has no omissions or duplicates", async () => {
    const scholarships: CatalogRow[] = Array.from({ length: 501 }, (_, i) => ({
      slug: `scholarship-${i + 1}`,
    }));
    const opportunities: CatalogRow[] = Array.from({ length: 501 }, (_, i) => ({
      slug: `opportunity-${i + 1}`,
    }));
    buildAllChains(scholarships, opportunities, [], []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    const scholarshipUrls = urls.filter((url) => url.startsWith(`${BASE}/scholarship/`));
    const opportunityUrls = urls.filter((url) => url.startsWith(`${BASE}/opportunity/`));

    expect(scholarshipUrls).toHaveLength(501);
    expect(opportunityUrls).toHaveLength(501);
    expect(new Set(scholarshipUrls).size).toBe(scholarshipUrls.length);
    expect(new Set(opportunityUrls).size).toBe(opportunityUrls.length);
  });

  it("does not emit misleading lastModified values", async () => {
    const scholarships: CatalogRow[] = [
      { slug: "scholarship-with-date" },
      { slug: "scholarship-without-date" },
    ];
    buildAllChains(scholarships, [], [], []);

    const result = await sitemap();

    for (const entry of result) {
      if (entry.url.startsWith(`${BASE}/scholarship/`) || entry.url.startsWith(`${BASE}/opportunity/`)) {
        expect(entry.lastModified).toBeUndefined();
      }
    }
  });

  it("preserves canonical https www host consistency", async () => {
    buildAllChains([], [], [], []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/www\.scholars\.com\.ng\//);
    }
  });

  it("has no duplicate canonical URLs", async () => {
    buildAllChains([], [], [], []);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
  });
});
