import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";
import { AdeProvider } from "@/components/ade/AdeProvider";

// middleware.ts already redirects unauthenticated requests to /login for
// everything under /dashboard, so `user` here is expected to be present.
// A missing profile row should no longer happen post signup-trigger, but
// the fallback (0%, no name) is kept defensively.
//
// Uses the shared React cache()-wrapped helper so this query is deduped
// with the one app/dashboard/page.tsx makes for the same request -- one
// Supabase round trip for both, not two.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUserAndProfile();

  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} />
      {/* pt-20 clears the fixed mobile top bar; md:pl-60 clears the fixed desktop rail */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 md:pt-10">
          <AdeProvider>{children}</AdeProvider>
        </div>
      </main>
    </div>
  );
}
