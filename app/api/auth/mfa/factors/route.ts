import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({
    factors: (data?.totp ?? []).map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name,
      status: factor.status,
      createdAt: factor.created_at,
    })),
  });
}
