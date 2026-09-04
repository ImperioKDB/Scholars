import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { AdeProvider } from "@/components/ade/AdeProvider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

// Replaces Inter (body) and IBM Plex Mono (data) with a single face.
// IBM Plex Mono doesn't ship a glyph for the Naira sign (U+20A6) -- the
// browser was silently substituting a different installed font just for
// that one character, which is what produced the broken-looking "N" with
// mismatched strokes on amount displays. Manrope's own Google Fonts
// latin-ext subset covers U+20A0-20AB, which includes U+20A6 directly, so
// it renders consistently everywhere instead of depending on whatever
// fallback font happens to be on a given device.
//
// Trade-off: IBM Plex Mono gave amounts/stat numbers fixed-width digit
// alignment; Manrope is proportional, so tightly-aligned numeric columns
// (e.g. the Applications status donut legend) won't line up digit-for-
// digit anymore. Flagging since this was a deliberate part of the
// original "data" font choice.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Scholars — Find scholarships you're actually eligible for",
  description:
    "Scholars matches your academic profile with scholarships you can realistically win, and keeps every deadline in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="font-sans bg-parchment text-ink antialiased">
        {/* AUDIT FIX (batch 2): AdeProvider lifted here from the four
            section layouts (dashboard/applications/achievements/
            scholarships). It used to remount on every route change
            between those sections, silently resetting Ade's dismissed
            prompts and seen-prompt tracking. At the root layout the
            instance survives navigation; the provider self-gates to the
            authenticated app routes via usePathname, so it renders (and
            polls) nothing on public pages like the landing, auth,
            /s/[id] share links, and the admin shell. */}
        <AdeProvider>{children}</AdeProvider>
      </body>
    </html>
  );
}
