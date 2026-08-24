import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

// middleware.ts already redirects unauthenticated requests to /login for
// everything under /dashboard, so `user` here is expected to be present.
// A missing profile row is still a normal state (user hit "Skip for now"
// during onboarding) -- the sidebar just falls back to no name / non-admin.
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
      <Sidebar fullName={fullName} isAdmin={isAdmin} />
      {/* pt-20 clears the fixed mobile top bar; md:pl-60 clears the fixed desktop rail */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 md:pt-10">{children}</div>
      </main>
    </div>
  );
}
