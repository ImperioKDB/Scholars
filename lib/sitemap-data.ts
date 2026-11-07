import { createPublicClient } from "./supabase/public";

export const SITEMAP_BATCH_SIZE = 500;

export type SitemapRow = {
  slug: string | null;
  updated_at: string;
};

export type ResourceSitemapRow = {
  slug: string | null;
  published_at: string | null;
};

export async function readAllPublicRows<T extends SitemapRow>(
  table: "scholarships" | "opportunities",
  select: string,
): Promise<T[]> {
  const supabase = createPublicClient();
  const rows: T[] = [];

  for (let from = 0; ; from += SITEMAP_BATCH_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("verified", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + SITEMAP_BATCH_SIZE - 1);

    if (error) {
      console.error(`[sitemap] failed to read public ${table}`, error);
      throw new Error(`Unable to build sitemap from public ${table}`);
    }

    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < SITEMAP_BATCH_SIZE) return rows;
  }
}

export async function readAllResourceRows(): Promise<ResourceSitemapRow[]> {
  const supabase = createPublicClient();
  const rows: ResourceSitemapRow[] = [];
  for (let from = 0; ; from += SITEMAP_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("resource_public_articles")
      .select("slug,published_at")
      .order("published_at", { ascending: false })
      .range(from, from + SITEMAP_BATCH_SIZE - 1);
    if (error) {
      console.error("[sitemap] failed to read public resources", error);
      throw new Error("Unable to build sitemap from public resources");
    }
    const batch = (data ?? []) as ResourceSitemapRow[];
    rows.push(...batch);
    if (batch.length < SITEMAP_BATCH_SIZE) return rows;
  }
}
