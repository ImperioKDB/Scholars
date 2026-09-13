import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

// Server-side admin assertion for API routes.
//
// The database privilege migration is the primary defense: normal API roles
// cannot write profiles.is_admin. This guard is defense in depth and also
// supports staged AAL2 enforcement through REQUIRE_ADMIN_MFA=true.
type Supabase = ReturnType<typeof createClient>;

export type AdminGuard =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

function adminMfaRequired(): boolean {
  return process.env.REQUIRE_ADMIN_MFA === "true";
}

export async function assertAdmin(
  supabase: Supabase,
  options: { requireAal2?: boolean } = {}
): Promise<AdminGuard> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.is_admin !== true) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  if (options.requireAal2 || adminMfaRequired()) {
    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (
      aalError ||
      aal?.currentLevel !== "aal2" ||
      aal?.nextLevel !== "aal2"
    ) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Multi-factor authentication required" },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, userId: user.id };
}
