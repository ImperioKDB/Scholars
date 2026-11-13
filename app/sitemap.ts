import type { MetadataRoute } from "next";
import { readAllPublicRows, readAllResourceRows, type SitemapRow } from "@/lib/sitemap-data";

// Query Supabase at request time so CI/build prerendering does not require live
// public data. Catalogue query failures are not swallowed: an unsuccessful
// query propagates as a server error instead of being masked as a complete,
// incomplete sitemap returning HTTP 200. An empty catalogue is a valid result
// and returns static/resource entries only.
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

  // The approved public catalogue views are the source of truth for anonymous
  // catalogue access. Raw scholarships/opportunities tables are not readable
  // by the anon role. Neither view exposes updated_at: scholarships carry
  // last_verified_at (used for lastModified where present) while opportunities
  // have no permitted timestamp, so their entries omit lastModified rather
  // than invent one. Closed (verified) records remain eligible: their detail
  // pages render a CLOSED status and stay discoverable here.
  const [scholarships, opportunities] = await Promise.all([
    readAllPublicRows<SitemapRow>(
      "scholarships_public_preview_v1",
      "id, slug, last_verified_at",
      "last_verified_at",
    ),
    readAllPublicRows<SitemapRow>(
      "opportunities_public_preview_v1",
      "id, slug",
      "id",
    ),
  ]);
  const resources = await readAllResourceRows();

  const scholarshipRoutes: MetadataRoute.Sitemap = scholarships.flatMap((row) =>
    row.slug
      ? [{
          url: `${base}/scholarship/${row.slug}`,
          lastModified: row.last_verified_at ? new Date(row.last_verified_at) : undefined,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }]
      : [],
  );
  const opportunityRoutes: MetadataRoute.Sitemap = opportunities.flatMap((row) =>
    row.slug
      ? [{
          url: `${base}/opportunity/${row.slug}`,
          // The opportunities preview view exposes no permitted timestamp;
          // omit lastModified rather than invent one.
          lastModified: undefined,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }]
      : [],
  );
  const resourceRoutes: MetadataRoute.Sitemap = resources.flatMap((row) =>
    row.slug
      ? [{
          url: `${base}/resources/${row.slug}`,
          lastModified: row.published_at ? new Date(row.published_at) : undefined,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        }]
      : [],
  );

  return [...staticRoutes, ...scholarshipRoutes, ...opportunityRoutes, ...resourceRoutes];
}
