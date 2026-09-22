import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { dbErrorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/validate";

async function getUser(request: Request) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const limited = await checkRateLimit(request, { route: "scholarship-discussion-helpful", limit: 30, extraKeys: [`user:${user.id}`] });
  if (limited) return { supabase, user, response: limited };
  return { supabase, user, response: null };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid discussion id" }, { status: 400 });
  const { supabase, user, response } = await getUser(request);
  if (response || !user) return response ?? NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { error } = await supabase.from("scholarship_discussion_reactions").insert({ discussion_id: params.id, profile_id: user.id });
  if (error && error.code !== "23505") return dbErrorResponse("scholarship_discussion_helpful", error);
  return NextResponse.json({ helpful: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid discussion id" }, { status: 400 });
  const { supabase, user, response } = await getUser(request);
  if (response || !user) return response ?? NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { error } = await supabase.from("scholarship_discussion_reactions").delete().eq("discussion_id", params.id).eq("profile_id", user.id);
  if (error) return dbErrorResponse("scholarship_discussion_helpful_delete", error);
  return NextResponse.json({ helpful: false });
}
