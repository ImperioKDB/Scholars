import type { MetadataRoute } from "next";

// app/manifest.ts
// Auto-served at /manifest.webmanifest. Lets Android Chrome offer "Add to
// home screen" with the Scholars brand (navy theme, parchment background)
// instead of a generic bookmark tile. Many of our students arrive on
// low-end Android phones where a home-screen icon is the difference
// between a bookmarked tool and a forgotten tab.
export default function manifest(): MetadataRoute.Manifest {
  // Vercel canonically redirects scholars.com.ng to www.scholars.com.ng.
  // Keep the installed PWA on that same origin; otherwise Android opens the
  // redirect as a Chrome Custom Tab, where the auth storage context differs.
  const appRoot =
    process.env.VERCEL_ENV === "production"
      ? "https://www.scholars.com.ng/"
      : "/";
  return {
    name: "Scholars | Find scholarships you're actually eligible for",
    short_name: "Scholars",
    description:
      "One profile, honest eligibility matching, and every deadline in one place. Built for students in Nigeria.",
    id: appRoot,
    start_url: appRoot,
    scope: appRoot,
    display: "standalone",
    background_color: "#F7F5EF",
    theme_color: "#0B1E3D",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
