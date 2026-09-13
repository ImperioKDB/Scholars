import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function adminMfaRequired(): boolean {
  return process.env.REQUIRE_ADMIN_MFA === "true";
}

// Server-only admin gate for Server Components. Database RLS and API guards
// remain the actual authorization boundaries.
export async function requireAdmin(options: { requireAal2?: boolean } = {}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.is_admin !== true) redirect("/dashboard");

  if (options.requireAal2 || adminMfaRequired()) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2" || aal?.nextLevel !== "aal2") {
      redirect("/settings/security?required=admin-mfa");
    }
  }

  return { userId: user!.id, fullName: profile.full_name as string | null };
}
