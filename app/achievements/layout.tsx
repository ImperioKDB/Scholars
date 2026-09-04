import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";

// Mirrors app/dashboard/layout.tsx and app/applications/layout.tsx.
// AUDIT FIX (batch 2): AdeProvider no longer wraps this layout -- it was
// lifted to the root layout (app/layout.tsx) so Ade's dismissed-prompt
// state survives navigation between sections instead of resetting on
// every route change.
export default async function AchievementsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUserAndProfile();
  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;
  const xpTotal = profile?.xp_total ?? 0;

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} xpTotal={xpTotal} />
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 md:pt-10">{children}</div>
      </main>
    </div>
  );
}
