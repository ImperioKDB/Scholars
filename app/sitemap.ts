import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

// app/sitemap.ts
// Auto-served at /sitemap.xml. Lists the static public routes plus every
// verified share page: /s/[id] for undergraduate-facing scholarships and
// /o/[id] for opportunities (fellowships, internships, competitions,
// mentorships). These are the surfaces we actually want indexed -- each one
// is a standalone, unauthenticated landing page for a real listing.
//
// revalidate = 3600 caps rebuild cost at one regeneration per hour while
// keeping new listings discoverable within a day of verification.
export const revalidate = 3600;

const STATIC_PATHS = [
  "/",
  "/about",
  "/legal/privacy",
  "/legal/terms",
  "/login",
  "/signup",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://scholars-eight.vercel.app";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: base + path,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1.0 : 0.5,
  }));

  // Public anon client: verified rows are readable by the public role
  // (scholarships_select_verified / opportunities_select_verified), so no
  // session or service key is needed.
  const supabase = createPublicClient();
  const [{ data: scholarships }, { data: opportunities }] = await Promise.all([
    supabase
      .from("scholarships")
      .select("id, updated_at")
      .eq("verified", true)
      .in("level", ["undergrad", "both"])
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("opportunities")
      .select("id, updated_at")
      .eq("verified", true)
      .order("updated_at", { ascending: false })
      .limit(1000),
  ]);

  const shareRoutes: MetadataRoute.Sitemap = (scholarships ?? []).map((row) => ({
    url: `${base}/s/${row.id}`,
    lastModified: new Date(row.updated_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const opportunityRoutes: MetadataRoute.Sitemap = (opportunities ?? []).map((row) => ({
    url: `${base}/o/${row.id}`,
    lastModified: new Date(row.updated_at),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...shareRoutes, ...opportunityRoutes];
}
