import type { MetadataRoute } from "next";
import { readAllPublicRows, type SitemapRow } from "@/lib/sitemap-data";

// Query Supabase at request time so CI/build prerendering does not require live
// public data. Fail-closed behavior remains active when the route is requested.
export const dynamic = "force-dynamic";
const STATIC_PATHS = [
  "/",
  "/about",
  "/reviews",
  "/scholarships-in-nigeria",
  "/opportunities-for-students",
  "/legal/privacy",
  "/legal/terms",
];

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
