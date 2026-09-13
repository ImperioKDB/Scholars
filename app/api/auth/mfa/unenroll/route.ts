import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ factorId: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    return NextResponse.json({ error: "MFA verification required" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid factor id" }, { status: 400 });
  }

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) {
    return NextResponse.json({ error: 'Could not list MFA factors' }, { status: 502 });
  }

  const verified = (factors?.totp ?? []).filter(
    (factor) => factor.status === "verified"
  );
  if (!verified.some((factor) => factor.id === parsed.data.factorId)) {
    return NextResponse.json({ error: "Verified factor not found" }, { status: 404 });
  }
  if (verified.length <= 1) {
    return NextResponse.json(
      { error: "Add and verify a backup factor before removing this factor" },
      { status: 409 }
    );
  }

  const { error } = await supabase.auth.mfa.unenroll({
    factorId: parsed.data.factorId,
  });
  if (error) {
    return NextResponse.json({ error: 'Could not unenroll MFA factor' }, { status: 502 });
  }

  return NextResponse.json({ removed: true });
}
