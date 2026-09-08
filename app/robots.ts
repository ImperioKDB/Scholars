import type { MetadataRoute } from "next";

// app/robots.ts
// Auto-served at /robots.txt. Public marketing and legal pages (and the
// public /s/[id] share pages, which are the growth channel) are open to
// crawlers; everything authenticated or internal is disallowed so search
// engines never surface dashboard, admin, or API URLs.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://scholars-eight.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/dashboard",
          "/discover",
          "/applications",
          "/achievements",
          "/settings",
          "/onboarding",
          "/scholarships",
          "/auth",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
