import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";

// middleware.ts already redirects unauthenticated requests to /login for
// everything under /dashboard, so `user` here is expected to be present.
// A missing profile row is still a normal state (user hit "Skip for now"
// during onboarding) — the nav just falls back to no name / non-admin.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    fullName = (profile?.full_name as string | null) ?? null;
    isAdmin = Boolean(profile?.is_admin);
  }

  return (
    <div className="min-h-screen bg-parchment">
      <DashboardNav fullName={fullName} isAdmin={isAdmin} />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
