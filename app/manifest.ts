import type { MetadataRoute } from "next";

// app/manifest.ts
// Auto-served at /manifest.webmanifest. Lets Android Chrome offer "Add to
// home screen" with the Scholars brand (navy theme, parchment background)
// instead of a generic bookmark tile. Many of our students arrive on
// low-end Android phones where a home-screen icon is the difference
// between a bookmarked tool and a forgotten tab.
export default function manifest(): MetadataRoute.Manifest {
  // Keep the apex origin as the canonical PWA origin. Existing installs were
  // created from scholars.com.ng, so changing this origin would strand their
  // manifest and auth storage behind a host change. Both production domains
  // currently serve this app directly; www remains a compatible entry point.
  const appRoot =
    process.env.VERCEL_ENV === "production"
      ? "https://scholars.com.ng/"
      : "/";
  return {
    name: "Scholars | Find scholarships you're actually eligible for",
    short_name: "Scholars",
    description:
      "One profile, honest eligibility matching, and every deadline in one place. Built for students in Nigeria.",
    // Keep the app identity stable at the site root, but open installed
    // Scholars directly into the authenticated dashboard. Existing installs
    // that still launch at `/` are covered by middleware's signed-in root
    // redirect while the manifest update rolls out.
    id: appRoot,
    start_url: `${appRoot}dashboard`,
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
