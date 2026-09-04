import Link from "next/link";
import { Logo } from "@/components/Logo";

// Shared chrome for /legal/privacy and /legal/terms: plain header and a
// centered reading column. Kept deliberately quiet -- these pages are
// for reading, not exploring. Public on purpose: legal pages must be
// reachable without an account (the footer links to them from the
// landing page).
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <Link href="/" aria-label="Scholars home">
            <Logo className="text-navy" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}
