import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";

// AUDIT FIX (batch 2): AdeProvider no longer wraps this layout -- it was
// lifted to the root layout (app/layout.tsx) so Ade's dismissed-prompt
// state survives navigation between sections instead of resetting on
// every route change.
//
// AUDIT FIX (batch 4): pb-24 on mobile keeps the last content on the page
// clear of the fixed bottom tab bar (see components/Sidebar.tsx). Desktop
// keeps the original pb-10 since there is no tab bar at md:+.
//
// AUDIT FIX (batch 5): id="main" is the target for the skip link that
// components/Sidebar.tsx renders on every section page.
export default async function ScholarshipsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUserAndProfile();
  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;
  const xpTotal = profile?.xp_total ?? 0;

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} xpTotal={xpTotal} />
      <main id="main" className="md:pl-60">
        <div className="mx-auto max-w-3xl px-6 pt-20 pb-24 md:pt-10 md:pb-10">{children}</div>
      </main>
    </div>
  );
}
