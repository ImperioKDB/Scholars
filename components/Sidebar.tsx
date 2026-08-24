"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

// Only links to pages that actually exist today (Dashboard, and Admin for
// admins). Discover and Saved are planned as separate pages later -- add
// their links here once they're built rather than shipping dead links now.
export function Sidebar({
  fullName,
  isAdmin,
}: {
  fullName: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", Icon: AdminIcon }] : []),
  ];

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navList = (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={[
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-navy text-white" : "text-navy-light hover:bg-navy-50 hover:text-navy",
            ].join(" ")}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const accountBlock = (
    <div className="px-3 py-4 border-t border-hairline">
      {fullName && <p className="px-3 text-sm text-navy-light mb-2 truncate">{fullName}</p>}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium text-navy-light hover:bg-navy-50 hover:text-navy transition-colors disabled:opacity-60"
      >
        {loggingOut ? "Logging out…" : "Log out"}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 border-r border-hairline bg-white">
        <div className="px-5 py-5 border-b border-hairline">
          <Logo className="text-navy" />
        </div>
        <div className="flex-1 px-3 py-4">{navList}</div>
        {accountBlock}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-hairline flex items-center justify-between px-4">
        <Logo className="text-navy" />
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-navy p-1.5">
          <MenuIcon />
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={[
          "md:hidden fixed inset-0 z-50 transition-opacity duration-200",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <div className="absolute inset-0 bg-navy/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
        <div
          className={[
            "absolute inset-y-0 left-0 w-72 max-w-[80%] bg-white flex flex-col transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="px-5 py-5 border-b border-hairline flex items-center justify-between">
            <Logo className="text-navy" />
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-navy p-1.5">
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 px-3 py-4">{navList}</div>
          {accountBlock}
        </div>
      </div>
    </>
  );
}
