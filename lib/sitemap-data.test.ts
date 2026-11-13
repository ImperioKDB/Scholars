import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("./supabase/public", () => ({
  createPublicClient: () => ({ from: mockFrom }),
}));

import { SITEMAP_BATCH_SIZE, readAllPublicRows, type PublicCatalogTable } from "./sitemap-data";

const lastVerifiedAt = "2026-11-06T00:00:00.000Z";

type TestRow = { slug: string | null; last_verified_at?: string | null };

function rows(prefix: string, count: number, offset = 0): TestRow[] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `${prefix}-${offset + index}`,
    last_verified_at: lastVerifiedAt,
  }));
}

function configureTable(
  table: PublicCatalogTable,
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
      "id, slug, last_verified_at",
      "last_verified_at",
    );

    expect(result).toHaveLength(501);
    expect(result.map((row) => row.slug)).toEqual(scholarshipRows.map((row) => row.slug));
    expect(calls).toEqual([[0, 499], [500, 999]]);
    expect(chain.eq).toHaveBeenCalledWith("verified", true);
    expect(chain.not).toHaveBeenCalledWith("slug", "is", null);
    expect(chain.order).toHaveBeenCalledWith("last_verified_at", {
      ascending: false,
    });
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
      "id",
    );

    expect(result).toHaveLength(501);
    expect(result.map((row) => row.slug)).toEqual(opportunityRows.map((row) => row.slug));
    expect(calls).toEqual([[0, 499], [500, 999]]);
  });

  it("supports both scholarship and opportunity public sources, including closed and postgraduate slugs", async () => {
    const scholarship = { slug: "postgraduate-scholarship", last_verified_at: lastVerifiedAt };
    const opportunity = { slug: "closed-opportunity" };
    const scholarshipConfig = configureTable("scholarships_public_preview_v1", [[scholarship]]);
    const scholarshipResult = await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug, last_verified_at",
      "last_verified_at",
    );
    const opportunityConfig = configureTable("opportunities_public_preview_v1", [[opportunity]]);
    const opportunityResult = await readAllPublicRows<TestRow>(
      "opportunities_public_preview_v1",
      "id, slug",
      "id",
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
      "id, slug, last_verified_at",
      "last_verified_at",
    );
    expect(result).toEqual([]);
  });

  it("returns an empty catalogue when the opportunity view has no rows", async () => {
    configureTable("opportunities_public_preview_v1", [[]]);
    const result = await readAllPublicRows<TestRow>(
      "opportunities_public_preview_v1",
      "id, slug",
      "id",
    );
    expect(result).toEqual([]);
  });

  it("excludes rows with missing slugs", async () => {
    const rowsWithNullSlug = [
      { slug: null, last_verified_at: lastVerifiedAt },
      { slug: "valid-slug", last_verified_at: lastVerifiedAt },
    ];
    configureTable("scholarships_public_preview_v1", [rowsWithNullSlug]);
    const result = await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug, last_verified_at",
      "last_verified_at",
    );
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("valid-slug");
  });

  it("fails closed when Supabase cannot read the scholarship public view", async () => {
    configureTable("scholarships_public_preview_v1", [], new Error("network unavailable"));

    await expect(
      readAllPublicRows<TestRow>(
        "scholarships_public_preview_v1",
        "id, slug, last_verified_at",
        "last_verified_at",
      ),
    ).rejects.toThrow("Unable to build sitemap from public scholarships_public_preview_v1");
  });

  it("fails closed when Supabase cannot read the opportunity public view", async () => {
    configureTable("opportunities_public_preview_v1", [], new Error("network unavailable"));

    await expect(
      readAllPublicRows<TestRow>(
        "opportunities_public_preview_v1",
        "id, slug",
        "id",
      ),
    ).rejects.toThrow("Unable to build sitemap from public opportunities_public_preview_v1");
  });

  it("does not query raw tables for public catalogue access", async () => {
    configureTable("scholarships_public_preview_v1", [[{ slug: "view-only-slug" }]]);
    await readAllPublicRows<TestRow>(
      "scholarships_public_preview_v1",
      "id, slug, last_verified_at",
      "last_verified_at",
    );
    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual([
      "scholarships_public_preview_v1",
    ]);
    expect(mockFrom.mock.calls.map(([table]) => table)).not.toContain("scholarships");
    expect(mockFrom.mock.calls.map(([table]) => table)).not.toContain("opportunities");
  });
});
