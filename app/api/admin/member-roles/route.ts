import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/admin/guard";
import { dbErrorResponse } from "@/lib/errors";

const roleSchema = z.object({
  profile_id: z.string().uuid(),
  community_role: z.enum(["student", "contributor"]),
});

export async function PATCH(request: Request) {
  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if (!guard.ok) return guard.response;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose Student or Contributor" }, { status: 400 });

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, community_role")
    .eq("id", parsed.data.profile_id)
    .maybeSingle();
  if (targetError) return dbErrorResponse("admin_member_role_target", targetError);
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.community_role === "founder") {
    return NextResponse.json({ error: "The Founder role is protected" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ community_role: parsed.data.community_role })
    .eq("id", parsed.data.profile_id)
    .select("id, community_role")
    .single();
  if (error) return dbErrorResponse("admin_member_role_update", error);
  return NextResponse.json({ profile: data });
}
