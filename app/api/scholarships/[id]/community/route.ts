import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { dbErrorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/validate";
import { loadScholarshipCommunity } from "@/lib/scholarship-community";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  category: z.enum(["question", "answer", "experience", "update"]),
  title: z.string().trim().max(140).optional().nullable(),
  body: z.string().trim().min(10).max(2000),
  is_anonymous: z.boolean().default(true),
  parent_id: z.string().uuid().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid scholarship id" }, { status: 400 });
  }
  const sort = new URL(request.url).searchParams.get("sort") === "recent" ? "recent" : "helpful";
  const supabase = createClient();
  const community = await loadScholarshipCommunity(supabase, params.id, sort);
  return NextResponse.json(community, {
    headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=60" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid scholarship id" }, { status: 400 });
  }
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = await checkRateLimit(request, {
    route: "scholarship-discussion-write",
    limit: 15,
    extraKeys: [`user:${user.id}`],
  });
  if (limited) return limited;

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the post details", issues: parsed.error.issues }, { status: 400 });
  }

  const { category, title, body, is_anonymous, parent_id } = parsed.data;
  if (category === "answer" && !parent_id) {
    return NextResponse.json({ error: "An answer needs a discussion to reply to" }, { status: 400 });
  }
  if (category !== "answer" && parent_id) {
    return NextResponse.json({ error: "Only answers can be replies" }, { status: 400 });
  }

  const { data: scholarship, error: scholarshipError } = await supabase
    .from("scholarships")
    .select("id")
    .eq("id", params.id)
    .eq("verified", true)
    .maybeSingle();
  if (scholarshipError) return dbErrorResponse("scholarship_discussion_scholarship_check", scholarshipError);
  if (!scholarship) return NextResponse.json({ error: "Scholarship not found" }, { status: 404 });

  if (parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from("scholarship_discussions")
      .select("id, scholarship_id, status")
      .eq("id", parent_id)
      .maybeSingle();
    if (parentError) return dbErrorResponse("scholarship_discussion_parent_check", parentError);
    if (!parent || parent.scholarship_id !== params.id || parent.status !== "published") {
      return NextResponse.json({ error: "That discussion is no longer available" }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from("scholarship_discussions")
    .insert({
      scholarship_id: params.id,
      author_id: user.id,
      parent_id: parent_id ?? null,
      category,
      title: title || null,
      body,
      is_anonymous,
    })
    .select("id, scholarship_id, parent_id, category, title, body, is_anonymous, created_at")
    .single();
  if (error) return dbErrorResponse("scholarship_discussions_insert", error);

  return NextResponse.json({ discussion: data }, { status: 201 });
}
