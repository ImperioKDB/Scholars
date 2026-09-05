import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";

export default async function AchievementsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUserAndProfile();
  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;
  const xpTotal = profile?.xp_total ?? 0;
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} xpTotal={xpTotal} avatarUrl={avatarUrl} />
      <main id="main" className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 md:pt-10 md:pb-10">{children}</div>
      </main>
    </div>
  );
}
