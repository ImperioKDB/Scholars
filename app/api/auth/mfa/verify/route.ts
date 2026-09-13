import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "MFA code must contain six digits"),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid MFA code" }, { status: 400 });
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: parsed.data.factorId });

  if (challengeError || !challenge) {
    return NextResponse.json(
      { error: challengeError?.message ?? "Could not create MFA challenge" },
      { status: 502 }
    );
  }

  const { data, error } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: "Invalid or expired MFA code" },
      { status: 401 }
    );
  }

  return NextResponse.json({ verified: true });
}
