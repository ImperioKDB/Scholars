import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const readSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

function messageFor(type: string, metadata: Record<string, unknown> | null | undefined) {
  if (type === "opportunity_deadline_passed") {
    const title = typeof metadata?.title === "string" ? metadata.title : "An opportunity";
    return `Deadline passed — review ${title}.`;
  }
  if (type === "new_match") {
    const title = typeof metadata?.title === "string" ? metadata.title : "A scholarship";
    return `A new scholarship match is available: ${title}.`;
  }
  if (type === "deadline_reminder") {
    const title = typeof metadata?.title === "string" ? metadata.title : "your saved scholarship";
    const days = typeof metadata?.days_until === "number" ? metadata.days_until : null;
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : days !== null && days > 1 ? `in ${days} days` : "soon";
    return `Your saved scholarship deadline is ${when}: ${title}.`;
  }
  if (type === "discussion_reply") return "Someone replied to your community post.";
  if (type === "discussion_helpful") return "Someone marked your community post as helpful.";
  return "You have a new Scholars update.";
}

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, created_at, read_at, scholarship_id, discussion_id, actor_profile_id, metadata")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return dbErrorResponse("notifications", error);

  const notifications = (data ?? []).map((item) => ({
    ...item,
    message: messageFor(String(item.type), item.metadata as Record<string, unknown> | null),
  }));
  return NextResponse.json({ notifications, unreadCount: notifications.filter((item) => !item.read_at).length });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = readSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.id && !parsed.data.all)) {
    return NextResponse.json({ error: "Choose a notification or mark all as read" }, { status: 400 });
  }

  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);
  if (parsed.data.id) query = query.eq("id", parsed.data.id);
  const { error } = await query;
  if (error) return dbErrorResponse("notifications_read", error);
  return NextResponse.json({ ok: true });
}
