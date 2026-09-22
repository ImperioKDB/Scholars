import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import { AdeProvider } from "@/components/ade/AdeProvider";
import { AuthRescue } from "@/components/AuthRescue";
import { CookieConsent } from "@/components/CookieConsent";
import { Monitoring } from "@/components/Monitoring";
import "./globals.css";
import "./motion.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng"),
  title: {
    default: "Scholars | Find scholarships you're actually eligible for",
    template: "%s | Scholars",
  },
  description:
    "Scholars matches your academic profile with scholarships you can realistically win, and keeps every deadline in one place.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Scholars",
    title: "Find scholarships you're actually eligible for",
    description:
      "Create one profile and discover verified scholarships for students in Nigeria.",
    url: "/",
    images: [{ url: "/logo.png", width: 256, height: 256, alt: "Scholars logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find scholarships you're actually eligible for",
    description:
      "Create one profile and discover verified scholarships for students in Nigeria.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable}`}>
      <body className="font-sans bg-parchment text-ink antialiased">
        {/* Rescues auth codes/tokens that Supabase strands on the root
            when a redirectTo is rejected (see components/AuthRescue.tsx).
            No-op everywhere else. */}
        <AuthRescue />
        <AdeProvider>{children}</AdeProvider>
        <Monitoring />
        {/* Essential-only cookie consent banner. Mounted outside
            AdeProvider so it renders even on public routes where Ade
            self-gates off (landing, /s/[id], /legal). Consent is stored
            in localStorage with a 1-year expiry. */}
        <CookieConsent />
      </body>
    </html>
  );
}
