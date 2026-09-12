// components/Sidebar.tsx
// REPAIR (build break at 90105e0): that commit replaced this module with an
// admin-only sidebar (default export), which both deleted the named
// `Sidebar` export the student shell layouts import and referenced two
// modules that were never committed. This file now exports BOTH shells:
//   - named export `Sidebar`: the student app shell (desktop aside, mobile
//     drawer, transient tab bar) exactly as it existed at 8a5edab.
//   - default export: the admin nav sidebar introduced in 90105e0.
// All icons live in components/icons.tsx so the two shells share one set
// without redefining component names in this scope.
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { FeedbackModal } from "@/components/FeedbackWidget";
import { levelForXp } from "@/lib/xp/level";
import { initialsFor } from "@/lib/text/initials";
import {
  DashboardIcon,
  ApplicationsIcon,
  AchievementsIcon,
  AdminIcon,
  DiscoverIcon,
  OpportunitiesIcon,
  SettingsIcon,
  FeedbackIcon,
  MenuIcon,
  CloseIcon,
  SpinnerIcon,
  HealthIcon,
  ScholarshipIcon,
  UsersIcon,
  TestimonialsIcon,
} from "@/components/icons";
const MOBILE_TABS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/applications", label: "Applications", Icon: ApplicationsIcon },
  { href: "/achievements", label: "Achievements", Icon: AchievementsIcon },
];
const BAR_HIDE_MS = 2500;
export function Sidebar({
  fullName,
  isAdmin,
  profileCompleteness,
  xpTotal,
  avatarUrl,
}: {
  fullName: string | null;
  isAdmin: boolean;
  profileCompleteness: number;
  xpTotal: number;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const barHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    function reveal() {
      setBarVisible(true);
      if (barHideTimer.current) clearTimeout(barHideTimer.current);
      barHideTimer.current = setTimeout(() => setBarVisible(false), BAR_HIDE_MS);
    }
    reveal();
    document.addEventListener("pointerdown", reveal);
    return () => {
      document.removeEventListener("pointerdown", reveal);
      if (barHideTimer.current) clearTimeout(barHideTimer.current);
    };
  }, []);

  // PRESENCE HEARTBEAT: update profiles.last_seen_at on mount and every
// 60 seconds while the app is open. Powers the Active/Idle/Offline
// buckets on /admin/users. Fire-and-forget with keepalive so it survives
// tab navigation and never blocks the UI. A missed tick is harmless --
// the next one still lands.
useEffect(() => {
  let cancelled = false;
  async function beat() {
    if (cancelled) return;
    try {
      await fetch("/api/heartbeat", { method: "POST", keepalive: true });
    } catch {
      // presence must never break the shell -- swallow silently
    }
  }
  beat();
  const id = window.setInterval(beat, 60_000);
  function onVisible() {
    if (document.visibilityState === "visible") beat();
  }
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    cancelled = true;
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}, []);
  const { level } = levelForXp(xpTotal);
  const navItems = [
    { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
    { href: "/discover", label: "Browse", Icon: DiscoverIcon },
    { href: "/opportunities", label: "Opportunities", Icon: OpportunitiesIcon },
    { href: "/applications", label: "Applications", Icon: ApplicationsIcon },
    { href: "/achievements", label: "Achievements", Icon: AchievementsIcon },
    { href: "/settings", label: "Profile", Icon: SettingsIcon },
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
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center font-display font-semibold text-sm shrink-0">
            {initialsFor(fullName)}
          </span>
        )}
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
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-xs font-mono font-medium text-navy">Lv {level} &middot; {xpTotal} XP</span>
        <Link href="/achievements" className="text-xs text-emerald font-medium hover:underline">
          Achievements
        </Link>
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
        onClick={() => setFeedbackOpen(true)}
        className="w-full inline-flex items-center gap-2.5 text-left rounded-lg px-3 py-2.5 text-sm font-medium text-navy-light hover:bg-navy-50 hover:text-navy transition-colors"
      >
        <FeedbackIcon />
        Send feedback
      </button>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-busy={loggingOut}
        className="w-full inline-flex items-center gap-2.5 text-left rounded-lg px-3 py-2.5 text-sm font-medium text-navy-light hover:bg-navy-50 hover:text-navy transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
      >
        {loggingOut && <SpinnerIcon />}
        {loggingOut ? "Logging out\u2026" : "Log out"}
      </button>
    </div>
  );
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 border-r border-hairline bg-white">
        <div className="px-5 py-5 border-b border-hairline">
          <Logo className="text-navy" />
        </div>
        {profileBlock}
        <div className="flex-1 px-3 py-4">{navList}</div>
        {accountBlock}
      </aside>
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-hairline flex items-center gap-3 px-4">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-navy p-1.5 -ml-1.5">
          <MenuIcon />
        </button>
        <Logo className="text-navy" />
      </header>
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
      <nav
        className={[
          "md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-hairline pb-[env(safe-area-inset-bottom)]",
          "transition-transform duration-300 motion-reduce:transition-none",
          barVisible ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="grid grid-cols-3">
          {MOBILE_TABS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-[11px] font-medium",
                  "transition active:scale-[0.96] motion-reduce:active:scale-100 motion-reduce:transition-none",
                  active ? "text-navy" : "text-navy-light",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex items-center justify-center rounded-full px-4 py-1 transition-colors",
                    active ? "bg-navy text-white" : "bg-transparent",
                  ].join(" ")}
                >
                  <Icon />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
// ---------------------------------------------------------------------------
// Admin nav sidebar (default export), as introduced in 90105e0. Kept
// verbatim apart from sourcing its icons from the shared module.
// ---------------------------------------------------------------------------
interface AdminNavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}
export default function AdminSidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const adminNavItems: AdminNavItem[] = [
    { href: "/admin", label: "Overview", Icon: DashboardIcon },
    { href: "/admin/health", label: "Health", Icon: HealthIcon },
    { href: "/admin/scholarships", label: "Scholarships", Icon: ScholarshipIcon },
    { href: "/admin/opportunities", label: "Opportunities", Icon: OpportunitiesIcon },
    { href: "/admin/active-users", label: "Active Users", Icon: UsersIcon },
    { href: "/admin/testimonials", label: "Testimonials", Icon: TestimonialsIcon },
  ];
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);
  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {isMobileMenuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>
      <aside
        className={`fixed inset-y-0 left-0 transform md:transform-none md:relative w-64 bg-white shadow-md z-40 h-full overflow-y-auto transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:block`}
      >
        <div className="p-6">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-display font-bold text-navy text-lg">Scholars Admin</span>
          </Link>
        </div>
        <nav className="mt-8">
          <h3 className="px-6 text-xs font-semibold text-navy-light uppercase tracking-wider">Management</h3>
          <ul className="mt-2">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${isActive
                      ? "text-navy bg-navy-50"
                      : "text-navy-light hover:text-navy hover:bg-gray-50"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.Icon className={`w-5 h-5 ${isActive ? "text-navy" : "text-navy-light"}`} />
                    {label(item)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
function label(item: AdminNavItem) {
  return item.label;
}
