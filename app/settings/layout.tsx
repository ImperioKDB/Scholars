import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";

// AUDIT FIX (batch 5): shell for the new /settings route. Mirrors the
// other section layouts exactly: AdeProvider lives in the root layout,
// pb-24 clears the mobile tab bar, id="main" is the skip-link target.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUserAndProfile();
  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;
  const xpTotal = profile?.xp_total ?? 0;

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} xpTotal={xpTotal} />
      <main id="main" className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 md:pt-10 md:pb-10">{children}</div>
      </main>
    </div>
  );
}
