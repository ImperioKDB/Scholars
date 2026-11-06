import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

const SITEMAP_BATCH_SIZE = 500;
const STATIC_PATHS = [
  "/",
  "/about",
  "/reviews",
  "/scholarships-in-nigeria",
  "/opportunities-for-students",
  "/legal/privacy",
  "/legal/terms",
];

type SitemapRow = {
  slug: string | null;
  updated_at: string;
};

async function readAllPublicRows<T extends SitemapRow>(
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const staticRoutes: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: base + path,
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1.0 : 0.5,
  }));

  // Verified rows are the public source of truth. Closed records remain
  // eligible for the sitemap when their detail pages retain useful history;
  // active feeds still apply their own deadline filters.
  const [scholarships, opportunities] = await Promise.all([
    readAllPublicRows<SitemapRow>("scholarships", "id, slug, updated_at"),
    readAllPublicRows<SitemapRow>("opportunities", "id, slug, updated_at"),
  ]);

  const scholarshipRoutes: MetadataRoute.Sitemap = scholarships.flatMap((row) =>
    row.slug
      ? [{
          url: `${base}/scholarship/${row.slug}`,
          lastModified: new Date(row.updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }]
      : [],
  );
  const opportunityRoutes: MetadataRoute.Sitemap = opportunities.flatMap((row) =>
    row.slug
      ? [{
          url: `${base}/opportunity/${row.slug}`,
          lastModified: new Date(row.updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }]
      : [],
  );

  return [...staticRoutes, ...scholarshipRoutes, ...opportunityRoutes];
}
