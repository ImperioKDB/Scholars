import type { MetadataRoute } from "next";

// app/manifest.ts
// Auto-served at /manifest.webmanifest. Lets Android Chrome offer "Add to
// home screen" with the Scholars brand (navy theme, parchment background)
// instead of a generic bookmark tile. Many of our students arrive on
// low-end Android phones where a home-screen icon is the difference
// between a bookmarked tool and a forgotten tab.
export default function manifest(): MetadataRoute.Manifest {
  // Keep the installed PWA on the host that served its manifest. Older
  // installs can retain the apex origin while newer installs use www.
  const appRoot = "/";
  return {
    name: "Scholars | Find scholarships you're actually eligible for",
    short_name: "Scholars",
    description:
      "One profile, honest eligibility matching, and every deadline in one place. Built for students in Nigeria.",
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
