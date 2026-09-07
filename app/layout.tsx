import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { AdeProvider } from "@/components/ade/AdeProvider";
import { AuthRescue } from "@/components/AuthRescue";
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

export const metadata: Metadata = {
  title: "Scholars | Find scholarships you're actually eligible for",
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
        {/* Rescues auth codes/tokens that Supabase strands on the root
            when a redirectTo is rejected (see components/AuthRescue.tsx).
            No-op everywhere else. */}
        <AuthRescue />
        <AdeProvider>{children}</AdeProvider>
      </body>
    </html>
  );
}
