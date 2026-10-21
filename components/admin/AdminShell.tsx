"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, DashboardIcon, DiscoverIcon, FeedbackIcon, HealthIcon, MenuIcon, OpportunitiesIcon, ScholarshipIcon, TestimonialsIcon, UsersIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";

type AdminIcon = React.ComponentType<{ className?: string }>;
type AdminNavItem = { href: string; label: string; description: string; Icon: AdminIcon };
type AdminNavGroup = { label: string; items: AdminNavItem[] };

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Overview", description: "Your operating snapshot", Icon: DashboardIcon },
      { href: "/admin/health", label: "Health", description: "System signals and checks", Icon: HealthIcon },
      { href: "/admin/analytics", label: "Provider analytics", description: "Listing performance", Icon: DiscoverIcon },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/scholarships", label: "Scholarships", description: "Manage verified listings", Icon: ScholarshipIcon },
      { href: "/admin/opportunities", label: "Opportunities", description: "Manage other pathways", Icon: OpportunitiesIcon },
      { href: "/admin/discovery", label: "Discovery", description: "Research and intake queue", Icon: DiscoverIcon },
      { href: "/admin/broadcast", label: "Broadcast", description: "Share updates with students", Icon: FeedbackIcon },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/community-invitations", label: "WhatsApp invitations", description: "Consent-based manual invites", Icon: UsersIcon },
      { href: "/admin/discussions", label: "Moderation", description: "Review community posts", Icon: FeedbackIcon },
      { href: "/admin/feedback", label: "Feedback", description: "Student reports and ideas", Icon: FeedbackIcon },
      { href: "/admin/testimonials", label: "Testimonials", description: "Publish student stories", Icon: TestimonialsIcon },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/users", label: "Users", description: "Profiles and roles", Icon: UsersIcon },
      { href: "/admin/active-users", label: "Active users", description: "Live activity", Icon: UsersIcon },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function currentLabel(pathname: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => isActive(pathname, entry.href));
    if (item) return item.label;
  }
  return "Admin";
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin navigation" className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <section key={group.label}>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-light/70">{group.label}</p>
          <div className="mt-2 space-y-1">
            {group.items.map(({ href, label, description, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-[50px] items-center gap-3 rounded-xl px-3 py-2.5 transition-[background-color,color,transform] active:scale-[0.99] motion-reduce:transition-none ${
                    active ? "bg-navy text-white shadow-card" : "text-navy-light hover:bg-navy-50 hover:text-navy"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white/10" : "bg-parchment group-hover:bg-white"}`}>
                    <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : "text-navy-light group-hover:text-navy"}`} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">{label}</span>
                    <span className={`mt-0.5 block truncate text-[11px] leading-tight ${active ? "text-white/70" : "text-navy-light/80"}`}>{description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function AdminShell({ fullName, children }: { fullName: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-hairline bg-white md:flex md:flex-col">
        <div className="border-b border-hairline px-5 py-5">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo className="text-navy" />
            <span className="rounded-seal bg-amber-light px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber">Admin</span>
          </Link>
          <p className="mt-3 text-xs leading-relaxed text-navy-light">A quiet control room for keeping Scholars accurate, useful, and healthy.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6">
          <Navigation pathname={pathname} />
        </div>
        <div className="border-t border-hairline p-3">
          <div className="mb-2 rounded-xl bg-parchment px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-light/70">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold text-navy">{fullName || "Admin"}</p>
          </div>
          <Link href="/dashboard" className="flex min-h-[44px] items-center justify-between rounded-xl px-3 text-sm font-medium text-navy-light transition-colors hover:bg-navy-50 hover:text-navy">
            Back to Scholars <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-hairline bg-white/95 px-4 backdrop-blur-sm md:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="admin-mobile-drawer" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-navy hover:bg-navy-50" aria-label="Open admin navigation">
          <MenuIcon />
        </button>
        <div className="text-center">
          <p className="font-display text-base font-semibold text-navy">{currentLabel(pathname)}</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber">Scholars admin</p>
        </div>
        <Link href="/dashboard" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-sm font-semibold text-navy-light hover:bg-navy-50" aria-label="Back to Scholars">↗</Link>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button type="button" onClick={() => setMobileOpen(false)} className="absolute inset-0 h-full w-full bg-navy/40" aria-label="Close admin navigation" />
          <aside id="admin-mobile-drawer" role="dialog" aria-modal="true" aria-label="Admin navigation" className="relative flex h-full w-[min(88vw,320px)] flex-col bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-5">
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3"><Logo className="text-navy" /><span className="rounded-seal bg-amber-light px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber">Admin</span></Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-navy hover:bg-navy-50" aria-label="Close admin navigation"><CloseIcon /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6"><Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} /></div>
            <div className="border-t border-hairline p-3"><Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex min-h-[44px] items-center justify-between rounded-xl px-3 text-sm font-medium text-navy-light hover:bg-navy-50 hover:text-navy">Back to Scholars <span aria-hidden="true">↗</span></Link></div>
          </aside>
        </div>
      )}

      <main id="main" className="min-h-screen md:ml-[272px]">
        <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-20 sm:px-6 md:px-8 md:pt-10 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
