import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

// app/sitemap.ts
// Auto-served at /sitemap.xml. Lists the static public routes plus every
// verified undergraduate-facing share page (/s/[id]), which is the surface
// we actually want indexed: each one is a standalone, unauthenticated
// landing page for a real scholarship.
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
  // (scholarships_select_verified), so no session or service key is needed.
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("scholarships")
    .select("id, updated_at")
    .eq("verified", true)
    .in("level", ["undergrad", "both"])
    .order("updated_at", { ascending: false })
    .limit(1000);
  const shareRoutes: MetadataRoute.Sitemap = (data ?? []).map((row) => ({
    url: `${base}/s/${row.id}`,
    lastModified: new Date(row.updated_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [...staticRoutes, ...shareRoutes];
}
