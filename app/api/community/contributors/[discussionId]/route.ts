import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";

type RouteContext = { params: { discussionId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const discussionId = z.string().uuid().safeParse(params.discussionId);
  if (!discussionId.success) {
    return NextResponse.json({ error: "Invalid discussion" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_community_contributor_profile", {
    p_discussion_id: discussionId.data,
  });
  if (error) return dbErrorResponse("community_contributor_profile", error);

  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile) {
    return NextResponse.json({ error: "Contributor profile not available" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
