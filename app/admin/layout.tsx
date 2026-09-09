import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { Logo } from "@/components/Logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { fullName } = await requireAdmin();
  return (
    <div className="min-h-screen bg-parchment">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Logo className="text-navy" />
            <span className="font-mono text-xs uppercase tracking-widest text-amber bg-amber-light px-2 py-1 rounded">
              Admin
            </span>
          </div>
          {/* MOBILE FIX: nav used to flex-wrap into a vertical column on
              narrow screens, blowing the header height out to ~6 rows.
              It is now a single horizontal row that scrolls sideways on
              mobile (whitespace-nowrap + overflow-x-auto) and stays a
              normal inline row on md+. */}
          <nav className="flex items-center gap-4 md:gap-6 text-sm overflow-x-auto md:overflow-visible whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/admin" className="text-navy-light hover:text-navy shrink-0">
              Overview
            </Link>
            <Link href="/admin/health" className="text-navy-light hover:text-navy shrink-0">
              Health
            </Link>
            <Link href="/admin/scholarships" className="text-navy-light hover:text-navy shrink-0">
              Scholarships
            </Link>
            <Link href="/admin/opportunities" className="text-navy-light hover:text-navy shrink-0">
              Opportunities
            </Link>
            <Link href="/admin/testimonials" className="text-navy-light hover:text-navy shrink-0">
              Testimonials
            </Link>
            <Link href="/dashboard" className="text-navy-light hover:text-navy shrink-0">
              Back to app
            </Link>
            {fullName && <span className="text-navy-light shrink-0">{fullName}</span>}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
