import Link from "next/link";
import { Logo } from "@/components/Logo";

// Shared chrome for /about: same quiet reading column as the legal pages,
// plus a Get started action since this page is a conversion surface for
// visitors who land here first. Public on purpose, like /legal/*.
export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link href="/" aria-label="Scholars home">
            <Logo className="text-navy" />
          </Link>
          <Link href="/signup" className="text-sm text-navy-light hover:text-navy">
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}
