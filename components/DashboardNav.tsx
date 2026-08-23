"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

// Only links to pages that actually exist today (Dashboard, and Admin for
// admins). Discover and Saved are planned as separate pages later — add
// their links here once they're built rather than shipping dead links now.
export function DashboardNav({
  fullName,
  isAdmin,
}: {
  fullName: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-hairline bg-white">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Logo className="text-navy" />
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/dashboard"
            className={pathname === "/dashboard" ? "text-navy font-medium" : "text-navy-light hover:text-navy"}
          >
            Dashboard
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-navy-light hover:text-navy">
              Admin
            </Link>
          )}
          {fullName && <span className="text-navy-light hidden sm:inline">{fullName}</span>}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-navy-light hover:text-navy font-medium disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </nav>
      </div>
    </header>
  );
}
