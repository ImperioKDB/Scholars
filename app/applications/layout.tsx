import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";
import { AdeProvider } from "@/components/ade/AdeProvider";

// Duplicates app/dashboard/layout.tsx rather than sharing via a route
// group -- kept deliberately simple. Worth consolidating into a shared
// app/(app)/layout.tsx if a third authenticated page shows up.
//
// Uses the shared React cache()-wrapped helper so this query is deduped
// with the one app/applications/page.tsx makes for the same request.
export default async function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUserAndProfile();

  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} />
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 md:pt-10">
          <AdeProvider>{children}</AdeProvider>
        </div>
      </main>
    </div>
  );
}
