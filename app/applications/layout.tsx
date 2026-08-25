import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

// Duplicates app/dashboard/layout.tsx rather than sharing via a route
// group -- a small amount of repetition, kept deliberately simple to avoid
// restructuring existing routes. Worth consolidating into a shared
// app/(app)/layout.tsx later if a third authenticated page shows up.
export default async function ApplicationsLayout({ children }: { children: React.ReactNode }) {
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
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 md:pt-10">{children}</div>
      </main>
    </div>
  );
}
