import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: mockFrom }),
}));

import sitemap from "./sitemap";

const BASE = "https://www.scholars.com.ng";

type CatalogRow = {
  slug: string | null;
  last_verified_at?: string | null;
  published_at?: string | null;
};

function chainFor(batches: Record<string, CatalogRow[]>, errorTable?: string) {
  const build = (table: string) => {
    const rows = batches[table] ?? [];
    const local = {
      select: vi.fn(() => local),
      eq: vi.fn(() => local),
      not: vi.fn(() => local),
      order: vi.fn(() => local),
      range: vi.fn(async (from: number, to: number) => {
        const batchIndex = from / 500;
        return { data: rows.slice(batchIndex * 500, (batchIndex + 1) * 500), error: null };
      }),
    };
    return local;
  };

  const errorChain = {
    select: vi.fn(() => errorChain),
    eq: vi.fn(() => errorChain),
    not: vi.fn(() => errorChain),
    order: vi.fn(() => errorChain),
    range: vi.fn(async () => ({ data: null, error: new Error("network unavailable") })),
  };

  mockFrom.mockImplementation((table: string) => {
    if (errorTable && table === errorTable) return errorChain;
    return build(table);
  });
}

describe("sitemap route", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    mockFrom.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_APP_URL = BASE;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("generates scholarship, opportunity, Resource Centre and static URLs with canonical www host", async () => {
    const scholarships = [
      { slug: "undergrad-scholarship", last_verified_at: "2026-11-01T00:00:00.000Z" },
      { slug: "postgraduate-scholarship", last_verified_at: "2026-11-05T00:00:00.000Z" },
      { slug: "closed-scholarship", last_verified_at: null },
      { slug: null, last_verified_at: "2026-11-01T00:00:00.000Z" },
    ];
    const opportunities = [
      { slug: "fellowship-opportunity" },
      { slug: "closed-opportunity" },
    ];
    const resources = [
      { slug: "how-to-find-legitimate-scholarships", published_at: "2026-11-11T00:00:00.000Z" },
      { slug: "how-to-write-a-scholarship-motivation-letter", published_at: null },
    ];

    chainFor({
      scholarships_public_preview_v1: scholarships,
      opportunities_public_preview_v1: opportunities,
      resource_public_articles: resources,
    });

    const result = await sitemap();

    const urls = result.map((entry) => entry.url);
    expect(urls).toContain(`${BASE}/scholarship/undergrad-scholarship`);
    expect(urls).toContain(`${BASE}/scholarship/postgraduate-scholarship`);
    expect(urls).toContain(`${BASE}/scholarship/closed-scholarship`);
    expect(urls).toContain(`${BASE}/opportunity/fellowship-opportunity`);
    expect(urls).toContain(`${BASE}/opportunity/closed-opportunity`);
    expect(urls).toContain(`${BASE}/resources/how-to-find-legitimate-scholarships`);
    expect(urls).toContain(`${BASE}/resources/how-to-write-a-scholarship-motivation-letter`);
    // Static public pages preserved.
    expect(urls).toContain(`${BASE}/`);
    expect(urls).toContain(`${BASE}/about`);
    expect(urls).toContain(`${BASE}/opportunities-for-students`);
    expect(urls).toContain(`${BASE}/scholarships-in-nigeria`);
    expect(urls).toContain(`${BASE}/legal/privacy`);
    expect(urls).toContain(`${BASE}/legal/terms`);

    // Rows with missing slugs are omitted.
    expect(urls).not.toContain(`${BASE}/scholarship/null`);
    expect(urls).not.toContain(`${BASE}/scholarship/undefined`);

    // All URLs use the canonical https www host.
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/www\.scholars\.com\.ng\//);
    }

    // No duplicates.
    expect(new Set(urls).size).toBe(urls.length);

    // lastModified is valid where a timestamp exists.
    const undergrad = result.find((entry) => entry.url === `${BASE}/scholarship/undergrad-scholarship`);
    expect(undergrad?.lastModified).toEqual(new Date("2026-11-01T00:00:00.000Z"));
    const noDate = result.find((entry) => entry.url === `${BASE}/scholarship/closed-scholarship`);
    expect(noDate?.lastModified).toBeUndefined();
    const opp = result.find((entry) => entry.url === `${BASE}/opportunity/fellowship-opportunity`);
    expect(opp?.lastModified).toBeUndefined();
  });

  it("excludes no verified closed records from the sitemap", async () => {
    const scholarships: CatalogRow[] = [
      { slug: "expired-but-verified-scholarship", last_verified_at: "2026-01-01T00:00:00.000Z" },
    ];
    const opportunities: CatalogRow[] = [];
    const resources: CatalogRow[] = [];

    chainFor({
      scholarships_public_preview_v1: scholarships,
      opportunities_public_preview_v1: opportunities,
      resource_public_articles: resources,
    });

    const result = await sitemap();
    expect(result).toContainEqual(
      expect.objectContaining({ url: `${BASE}/scholarship/expired-but-verified-scholarship` }),
    );
  });

  it("does not silently convert a failed scholarship catalogue query into a successful incomplete sitemap", async () => {
    chainFor(
      {
        scholarships_public_preview_v1: [],
        opportunities_public_preview_v1: [],
        resource_public_articles: [],
      },
      "scholarships_public_preview_v1",
    );

    await expect(sitemap()).rejects.toThrow(
      "Unable to build sitemap from public scholarships_public_preview_v1",
    );
  });

  it("does not silently convert a failed opportunity catalogue query into a successful incomplete sitemap", async () => {
    chainFor(
      {
        scholarships_public_preview_v1: [],
        opportunities_public_preview_v1: [],
        resource_public_articles: [],
      },
      "opportunities_public_preview_v1",
    );

    await expect(sitemap()).rejects.toThrow(
      "Unable to build sitemap from public opportunities_public_preview_v1",
    );
  });
});
