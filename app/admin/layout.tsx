import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { Logo } from "@/components/Logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { fullName } = await requireAdmin();

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="text-navy" />
            <span className="font-mono text-xs uppercase tracking-widest text-amber bg-amber-light px-2 py-1 rounded">
              Admin
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/admin" className="text-navy-light hover:text-navy">
              Overview
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
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
