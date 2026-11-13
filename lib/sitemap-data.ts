import { createPublicClient } from "./supabase/public";
import { hasPublicSupabaseConfig } from "./supabase/config";
import { LOCAL_RESOURCE_ARTICLES, LOCAL_RESOURCE_CATEGORIES, getLocalResourceArticlesForCategory } from "./resource-content";

export const SITEMAP_BATCH_SIZE = 500;

export type SitemapRow = {
  slug: string | null;
};

export type PublicCatalogTable =
  | "scholarships_public_preview_v1"
  | "opportunities_public_preview_v1";

export type ResourceSitemapRow = {
  slug: string | null;
  published_at: string | null;
};

export type ResourceCategorySitemapRow = {
  slug: string | null;
};

export async function readAllPublicRows<T extends SitemapRow>(
  table: PublicCatalogTable,
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
  const repositoryRows = LOCAL_RESOURCE_ARTICLES.map((article) => ({ slug: article.slug, published_at: article.published_at }));
  if (!hasPublicSupabaseConfig()) return repositoryRows;
  const supabase = createPublicClient();
  const rows: ResourceSitemapRow[] = [...repositoryRows];
  for (let from = 0; ; from += SITEMAP_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("resource_public_articles")
      .select("slug,published_at")
      .order("published_at", { ascending: false })
      .range(from, from + SITEMAP_BATCH_SIZE - 1);
    if (error) {
      console.error("[sitemap] failed to read public resources", error);
      return rows;
    }
    const batch = (data ?? []) as ResourceSitemapRow[];
    batch.forEach((row) => {
      if (row.slug && !rows.some((existing) => existing.slug === row.slug)) rows.push(row);
    });
    if (batch.length < SITEMAP_BATCH_SIZE) return rows;
  }
}

/**
 * Collect category slugs that have at least one published local article.
 * Uses getLocalResourceArticlesForCategory because LOCAL_RESOURCE_ARTICLES
 * items are ResourceArticleCard (no categories property); category
 * assignments live in articleDefinitions and are accessible via
 * getLocalResourceArticlesForCategory.
 */
function eligibleLocalCategorySlugs(): Set<string> {
  const eligible = new Set<string>();
  for (const category of LOCAL_RESOURCE_CATEGORIES) {
    if (getLocalResourceArticlesForCategory(category.slug).length > 0) {
      eligible.add(category.slug);
    }
  }
  return eligible;
}

export async function readAllResourceCategoryRows(): Promise<ResourceCategorySitemapRow[]> {
  const repositoryRows = LOCAL_RESOURCE_CATEGORIES.map((category) => ({ slug: category.slug }));
  const eligibleLocalSlugs = eligibleLocalCategorySlugs();

  if (!hasPublicSupabaseConfig()) {
    return repositoryRows.filter((row) => row.slug && eligibleLocalSlugs.has(row.slug));
  }

  const supabase = createPublicClient();

  // The resource_public_article_categories view already filters to only
  // published articles and active categories, so any category slug returned
  // from it is sitemap-eligible.
  const eligibleDbSlugs = new Set<string>();
  const dbCategoryRows: ResourceCategorySitemapRow[] = [];
  for (let from = 0; ; from += SITEMAP_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("resource_public_article_categories")
      .select("slug")
      .order("slug", { ascending: true })
      .range(from, from + SITEMAP_BATCH_SIZE - 1);

    if (error) {
      console.error("[sitemap] failed to read public resource article categories", error);
      // Fall back to local categories that have local articles.
      return repositoryRows.filter((row) => row.slug && eligibleLocalSlugs.has(row.slug));
    }

    const batch = (data ?? []) as ResourceCategorySitemapRow[];
    batch.forEach((row) => {
      if (row.slug) {
        eligibleDbSlugs.add(row.slug);
        dbCategoryRows.push(row);
      }
    });

    if (batch.length < SITEMAP_BATCH_SIZE) break;
  }

  const allEligibleSlugs = new Set([...eligibleLocalSlugs, ...eligibleDbSlugs]);

  // Combine local and DB category rows, deduplicate by slug, keep only eligible.
  const allRows = [...repositoryRows, ...dbCategoryRows];
  const seen = new Set<string>();
  const result: ResourceCategorySitemapRow[] = [];

  for (const row of allRows) {
    if (row.slug && allEligibleSlugs.has(row.slug) && !seen.has(row.slug)) {
      seen.add(row.slug);
      result.push(row);
    }
  }

  return result;
}
