import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("./supabase/public", () => ({
  createPublicClient: () => ({ from: mockFrom }),
}));

import { SITEMAP_BATCH_SIZE, readAllPublicRows } from "./sitemap-data";

const updatedAt = "2026-11-06T00:00:00.000Z";

type TestRow = { slug: string | null; updated_at: string };

function rows(prefix: string, count: number, offset = 0): TestRow[] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `${prefix}-${offset + index}`,
    updated_at: updatedAt,
  }));
}

function configureTable(table: "scholarships" | "opportunities", batches: TestRow[][], error?: Error) {
  const calls: Array<[number, number]> = [];
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(async (from: number, to: number) => {
      calls.push([from, to]);
      const batchIndex = from / SITEMAP_BATCH_SIZE;
      if (error) return { data: null, error };
      return { data: batches[batchIndex] ?? [], error: null };
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

describe("sitemap data reader", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("retrieves all records across 500-row batches without omissions or duplicate URLs", async () => {
    const scholarshipRows = [...rows("scholarship", SITEMAP_BATCH_SIZE), ...rows("scholarship", 1, SITEMAP_BATCH_SIZE)];
    const { chain, calls } = configureTable("scholarships", [scholarshipRows.slice(0, SITEMAP_BATCH_SIZE), scholarshipRows.slice(SITEMAP_BATCH_SIZE)]);

    const result = await readAllPublicRows("scholarships", "id, slug, updated_at");

    expect(result).toHaveLength(501);
    expect(new Set(result.map((row) => row.slug)).size).toBe(501);
    expect(calls).toEqual([[0, 499], [500, 999]]);
    expect(chain.eq).toHaveBeenCalledWith("verified", true);
    expect(chain.not).toHaveBeenCalledWith("slug", "is", null);
  });

  it("supports both scholarship and opportunity public sources, including closed and postgraduate slugs", async () => {
    const scholarship = { slug: "postgraduate-scholarship", updated_at: updatedAt };
    const opportunity = { slug: "closed-opportunity", updated_at: updatedAt };
    const scholarshipConfig = configureTable("scholarships", [[scholarship]]);
    const scholarshipResult = await readAllPublicRows("scholarships", "id, slug, updated_at");
    const opportunityConfig = configureTable("opportunities", [[opportunity]]);
    const opportunityResult = await readAllPublicRows("opportunities", "id, slug, updated_at");

    expect(scholarshipResult).toEqual([scholarship]);
    expect(opportunityResult).toEqual([opportunity]);
    expect(scholarshipConfig.calls).toEqual([[0, 499]]);
    expect(opportunityConfig.calls).toEqual([[0, 499]]);
  });

  it("fails closed when Supabase cannot read a public source", async () => {
    configureTable("opportunities", [], new Error("network unavailable"));

    await expect(readAllPublicRows("opportunities", "id, slug, updated_at"))
      .rejects.toThrow("Unable to build sitemap from public opportunities");
  });
});
