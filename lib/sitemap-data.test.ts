import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("./supabase/public", () => ({
  createPublicClient: () => ({ from: mockFrom }),
}));

import {
  SITEMAP_BATCH_SIZE,
  readAllPublicRows,
  readAllResourceRows,
  readAllResourceCategoryRows,
  type PublicCatalogTable,
} from "./sitemap-data";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  mockFrom.mockReset();
});

const slug = (prefix: string, index: number) => `${prefix}-${index}`;

type TestRow = { slug: string | null };

function rows(prefix: string, count: number, offset = 0): TestRow[] {
  return Array.from({ length: count }, (_, index) => ({
    slug: slug(prefix, offset + index),
  }));
}

function configureTable(
  table: string,
  batches: TestRow[][],
  error?: Error,
) {
  const calls: Array<[number, number]> = [];
  let slugNotNull = false;
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn((column: string, operator: string, value: unknown) => {
      if (column === "slug" && operator === "is" && value === null) slugNotNull = true;
      return chain;
    }),
    order: vi.fn(() => chain),
    range: vi.fn(async (from: number, to: number) => {
      calls.push([from, to]);
      const batchIndex = from / SITEMAP_BATCH_SIZE;
      if (error) return { data: null, error };
      let batch = (batches[batchIndex] ?? []) as TestRow[];
      if (slugNotNull) batch = batch.filter((row) => row.slug !== null);
      return { data: batch, error: null };
    }),
  };

  mockFrom.mockImplementation((requestedTable: string) => {
    if (requestedTable === table) return chain;
    return {
      ...chain,
      range: vi.fn(async () => ({ data: [], error: null })),
    };
  });

  return { chain, calls };
}

describe("sitemap data reader (public catalogue views)", () => {
  beforeEach(() => {
    setPublicConfig(true);
    mockFrom.mockReset();
  });

  it("retrieves all scholarship rows across 500-row batches without omissions", async () => {
    const scholarshipRows = [
      ...rows("scholarship", SITEMAP_BATCH_SIZE),
      ...rows("scholarship", 1, SITEMAP_BATCH_SIZE),
    ];
    const { chain, calls } = configureTable("scholarships_public_preview_v1", [
      scholarshipRows.slice(0, SITEMAP_BATCH_SIZE),
      scholarshipRows.slice(SITEMAP_BATCH_SIZE),
    ]);

    const result = await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug",
    );

    expect(result).toHaveLength(501);
    expect(result.map((row) => row.slug)).toEqual(scholarshipRows.map((row) => row.slug));
    expect(calls).toEqual([[0, 499], [500, 999]]);
    expect(chain.eq).toHaveBeenCalledWith("verified", true);
    expect(chain.not).toHaveBeenCalledWith("slug", "is", null);
    expect(chain.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("retrieves all opportunity rows across 500-row batches without omissions", async () => {
    const opportunityRows = [
      ...rows("opportunity", SITEMAP_BATCH_SIZE),
      ...rows("opportunity", 1, SITEMAP_BATCH_SIZE),
    ];
    const { chain, calls } = configureTable("opportunities_public_preview_v1", [
      opportunityRows.slice(0, SITEMAP_BATCH_SIZE),
      opportunityRows.slice(SITEMAP_BATCH_SIZE),
    ]);

    const result = await readAllPublicRows<TestRow>(
      "opportunities_public_preview_v1",
      "id, slug",
    );

    expect(result).toHaveLength(501);
    expect(result.map((row) => row.slug)).toEqual(opportunityRows.map((row) => row.slug));
    expect(calls).toEqual([[0, 499], [500, 999]]);
    // All order calls use id ascending -- no conflicting duplicate order clause.
    const orderCalls = (chain.order as ReturnType<typeof vi.fn> & { mock: { calls: unknown[] } }).mock.calls;
    for (const [col, dir] of orderCalls) {
      expect(col).toBe("id");
      expect(dir).toEqual({ ascending: true });
    }
  });

  it("supports both scholarship and opportunity public sources, including closed and postgraduate slugs", async () => {
    const scholarship = { slug: "postgraduate-scholarship" };
    const opportunity = { slug: "closed-opportunity" };
    const scholarshipConfig = configureTable("scholarships_public_preview_v1", [[scholarship]]);
    const scholarshipResult = await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug",
    );
    const opportunityConfig = configureTable("opportunities_public_preview_v1", [[opportunity]]);
    const opportunityResult = await readAllPublicRows<TestRow>(
      "opportunities_public_preview_v1",
      "id, slug",
    );

    expect(scholarshipResult).toEqual([scholarship]);
    expect(opportunityResult).toEqual([opportunity]);
    expect(scholarshipConfig.calls).toEqual([[0, 499]]);
    expect(opportunityConfig.calls).toEqual([[0, 499]]);
  });

  it("returns an empty catalogue when the scholarship view has no rows", async () => {
    configureTable("scholarships_public_preview_v1", [[]]);
    const result = await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug",
    );
    expect(result).toEqual([]);
  });

  it("returns an empty catalogue when the opportunity view has no rows", async () => {
    configureTable("opportunities_public_preview_v1", [[]]);
    const result = await readAllPublicRows<TestRow>(
      "opportunities_public_preview_v1",
      "id, slug",
    );
    expect(result).toEqual([]);
  });

  it("excludes rows with missing slugs", async () => {
    const rowsWithNullSlug = [
      { slug: null },
      { slug: "valid-slug" },
    ];
    configureTable("scholarships_public_preview_v1", [rowsWithNullSlug]);
    const result = await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug",
    );
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("valid-slug");
  });

  it("fails closed when Supabase cannot read the scholarship public view", async () => {
    configureTable("scholarships_public_preview_v1", [], new Error("network unavailable"));

    await expect(
      readAllPublicRows<TestRow>(
        "scholarships_public_preview_v1",
        "id, slug",
      ),
    ).rejects.toThrow("Unable to build sitemap from public scholarships_public_preview_v1");
  });

  it("fails closed when Supabase cannot read the opportunity public view", async () => {
    configureTable("opportunities_public_preview_v1", [], new Error("network unavailable"));

    await expect(
      readAllPublicRows<TestRow>(
        "opportunities_public_preview_v1",
        "id, slug",
      ),
    ).rejects.toThrow("Unable to build sitemap from public opportunities_public_preview_v1");
  });

  it("does not query raw tables for public catalogue access", async () => {
    configureTable("scholarships_public_preview_v1", [[{ slug: "view-only-slug" }]]);
    await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug",
    );
    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual([
      "scholarships_public_preview_v1",
    ]);
    expect(mockFrom.mock.calls.map(([table]) => table)).not.toContain("scholarships");
    expect(mockFrom.mock.calls.map(([table]) => table)).not.toContain("opportunities");
  });

  it("orders scholarships deterministically by id with unique tie-breaker", async () => {
    const scholarshipRows = [
      { slug: "scholarship-b" },
      { slug: "scholarship-a" },
    ];
    const { chain } = configureTable("scholarships_public_preview_v1", [scholarshipRows]);

    await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug",
    );

    // order("id", { ascending: true }) is called -- deterministic, id is unique.
    const orderCalls = (chain.order as ReturnType<typeof vi.fn> & { mock: { calls: unknown[] } }).mock.calls;
    expect(orderCalls).toContainEqual(["id", { ascending: true }]);
  });
});

describe("sitemap resource reader (local fallback + database merge)", () => {
  beforeEach(() => {
    setPublicConfig(true);
    mockFrom.mockReset();
  });

  it("returns local resource articles when Supabase is not configured", async () => {
    setPublicConfig(false);

    const result = await readAllResourceRows();

    expect(result.length).toBeGreaterThan(0);
    const localSlugs = ["how-to-find-legitimate-scholarships", "how-to-write-a-scholarship-motivation-letter"];
    for (const slug of localSlugs) {
      expect(result.some((row) => row.slug === slug)).toBe(true);
    }
  });

  it("merges database resource articles with local articles without duplicate slugs", async () => {
    const dbRows = [
      { slug: "how-to-find-legitimate-scholarships", published_at: "2026-01-01T00:00:00.000Z" },
      { slug: "new-db-article", published_at: "2026-02-01T00:00:00.000Z" },
    ];
    // resource_public_articles is configured; resource_public_article_categories gets empty chain.
    mockFrom.mockImplementation((requestedTable: string) => {
      if (requestedTable === "resource_public_articles") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(async (from: number, to: number) => {
                const batchIndex = from / SITEMAP_BATCH_SIZE;
                return { data: dbRows.slice(batchIndex * SITEMAP_BATCH_SIZE, (batchIndex + 1) * SITEMAP_BATCH_SIZE), error: null };
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      };
    });

    const result = await readAllResourceRows();

    expect(result.some((row) => row.slug === "new-db-article")).toBe(true);
    const duplicates = result.filter((row) => row.slug === "how-to-find-legitimate-scholarships");
    expect(duplicates.length).toBe(1);
  });

  it("returns local resource articles when the resource query fails", async () => {
    mockFrom.mockImplementation((requestedTable: string) => {
      if (requestedTable === "resource_public_articles") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(async () => ({ data: null, error: new Error("network unavailable") })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      };
    });

    const result = await readAllResourceRows();

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((row) => row.slug === "how-to-find-legitimate-scholarships")).toBe(true);
  });

  it("returns local resource categories when Supabase is not configured", async () => {
    setPublicConfig(false);

    const result = await readAllResourceCategoryRows();

    expect(result.length).toBe(6);
    const slugs = result.map((row) => row.slug).filter(Boolean);
    expect(slugs).toContain("scholarship-applications");
    expect(slugs).toContain("scam-awareness");
  });

  it("returns local resource categories when the category query fails", async () => {
    mockFrom.mockImplementation((requestedTable: string) => {
      if (requestedTable === "resource_public_article_categories") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(async () => ({ data: null, error: new Error("network unavailable") })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      };
    });

    const result = await readAllResourceCategoryRows();

    expect(result.length).toBe(6);
  });

  it("merges database resource categories with local categories without duplicate slugs", async () => {
    const dbRows = [
      { slug: "scholarship-applications" },
      { slug: "new-db-category" },
    ];
    mockFrom.mockImplementation((requestedTable: string) => {
      if (requestedTable === "resource_public_article_categories") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(async (from: number, to: number) => {
                const batchIndex = from / SITEMAP_BATCH_SIZE;
                return { data: dbRows.slice(batchIndex * SITEMAP_BATCH_SIZE, (batchIndex + 1) * SITEMAP_BATCH_SIZE), error: null };
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      };
    });

    const result = await readAllResourceCategoryRows();

    expect(result.some((row) => row.slug === "new-db-category")).toBe(true);
    const duplicates = result.filter((row) => row.slug === "scholarship-applications");
    expect(duplicates.length).toBe(1);
  });
});
