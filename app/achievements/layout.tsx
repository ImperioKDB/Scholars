import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";
import { AdeProvider } from "@/components/ade/AdeProvider";

// Mirrors app/dashboard/layout.tsx and app/applications/layout.tsx.
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
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 md:pt-10">
          <AdeProvider>{children}</AdeProvider>
        </div>
      </main>
    </div>
  );
}
