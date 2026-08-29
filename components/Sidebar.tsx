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

function ApplicationsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 8h4" strokeLinecap="round" />
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

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function initialsFor(name: string | null): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Only links to pages that actually exist today. Discover/Saved are
// planned as separate pages later -- add their links here once they're
// built rather than shipping dead links now.
export function Sidebar({
  fullName,
  isAdmin,
  profileCompleteness,
}: {
  fullName: string | null;
  isAdmin: boolean;
  profileCompleteness: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
    { href: "/applications", label: "Applications", Icon: ApplicationsIcon },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", Icon: AdminIcon }] : []),
  ];

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const profileBlock = (
    <div className="px-4 py-4 border-b border-hairline">
      <div className="flex items-center gap-3 mb-2.5">
        <span className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center font-display font-semibold text-sm shrink-0">
          {initialsFor(fullName)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{fullName || "Welcome"}</p>
          <p className="text-xs text-navy-light">{profileCompleteness}% profile complete</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-hairline overflow-hidden">
        <div
          className={`h-full rounded-full ${profileCompleteness === 100 ? "bg-emerald" : "bg-navy"}`}
          style={{ width: `${profileCompleteness}%` }}
        />
      </div>
    </div>
  );

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
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-busy={loggingOut}
        className="w-full inline-flex items-center gap-2.5 text-left rounded-lg px-3 py-2.5 text-sm font-medium text-navy-light hover:bg-navy-50 hover:text-navy transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
      >
        {loggingOut && <SpinnerIcon />}
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
        {profileBlock}
        <div className="flex-1 px-3 py-4">{navList}</div>
        {accountBlock}
      </aside>

      {/* Mobile top bar -- hamburger on the left, same side the drawer opens from */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-hairline flex items-center gap-3 px-4">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-navy p-1.5 -ml-1.5">
          <MenuIcon />
        </button>
        <Logo className="text-navy" />
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
          {profileBlock}
          <div className="flex-1 px-3 py-4">{navList}</div>
          {accountBlock}
        </div>
      </div>
    </>
  );
}
