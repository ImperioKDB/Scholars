import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/admin/guard";
import { checkRateLimit } from "@/lib/ratelimit";
import { dbErrorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/validate";

const updateSchema = z.object({
  status: z.enum(["published", "hidden"]).optional(),
  is_pinned: z.boolean().optional(),
  is_verified_contributor: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const limited = await checkRateLimit(request, { route: "admin-discussion-update", limit: 60 });
  if (limited) return limited;
  if (!isUuid(params.id)) return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if (!guard.ok) return guard.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid moderation update" }, { status: 400 });
  const { data, error } = await supabase
    .from("scholarship_discussions")
    .update(parsed.data)
    .eq("id", params.id)
    .select("id, status, is_pinned, is_verified_contributor")
    .maybeSingle();
  if (error) return dbErrorResponse("admin/discussions/update", error);
  if (!data) return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
  return NextResponse.json({ discussion: data });
}
