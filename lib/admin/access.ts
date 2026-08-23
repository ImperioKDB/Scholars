import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Server-only. Checks profiles.is_admin for the current session and redirects
// non-admins away. This is a UX gate, not the security boundary — the real
// enforcement is the is_admin(auth.uid()) RLS policy on scholarships /
// scholarship_rules, so a client-side bug here can't expose write access.
export async function requireAdmin() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return { userId: user!.id, fullName: profile.full_name as string | null };
}
