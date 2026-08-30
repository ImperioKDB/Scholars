import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { Sidebar } from "@/components/Sidebar";

// Mirrors app/dashboard/layout.tsx and app/applications/layout.tsx.
// Worth consolidating all three into a shared app/(app)/layout.tsx at
// some point -- kept separate for now to match the existing pattern in
// this codebase rather than introducing a route group unilaterally.
export default async function ScholarshipsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUserAndProfile();

  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} />
      <main className="md:pl-60">
        <div className="mx-auto max-w-3xl px-6 pt-20 pb-10 md:pt-10">{children}</div>
      </main>
    </div>
  );
}
