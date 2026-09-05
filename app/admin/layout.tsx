import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { Logo } from "@/components/Logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { fullName } = await requireAdmin();

  return (
    <div className="min-h-screen bg-parchment">
      {/* AUDIT FIX (batch 5): keyboard skip link -- admin doesn't render
          the Sidebar that carries it everywhere else, so it gets its
          own. Target is the <main id="main"> below. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="text-navy" />
            <span className="font-mono text-xs uppercase tracking-widest text-amber bg-amber-light px-2 py-1 rounded">
              Admin
            </span>
          </div>
          {/* flex-wrap: four nav items plus the admin name overflowed on
              narrow screens with the Health link added. */}
          <nav className="flex items-center gap-6 text-sm flex-wrap justify-end">
            <Link href="/admin" className="text-navy-light hover:text-navy">
              Overview
            </Link>
            <Link href="/admin/health" className="text-navy-light hover:text-navy">
              Health
            </Link>
            <Link href="/admin/scholarships" className="text-navy-light hover:text-navy">
              Scholarships
            </Link>
            <Link href="/dashboard" className="text-navy-light hover:text-navy">
              Back to app
            </Link>
            {fullName && <span className="text-navy-light">{fullName}</span>}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
