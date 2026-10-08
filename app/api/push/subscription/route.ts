import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { checkRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(40).max(200),
    auth: z.string().min(10).max(100),
  }),
});

const endpointSchema = z.object({ endpoint: z.string().url().max(2048) });

function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "fcm.googleapis.com" ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host === "push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host === "notify.windows.com" ||
      host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

async function getAuthenticatedUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const limited = await checkRateLimit(request, { route: "web-push-subscription", limit: 10, extraKeys: [`user:${user.id}`] });
  if (limited) return limited;

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }
  if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  const { error } = await supabase.from("web_push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,endpoint" },
  );
  if (error) return dbErrorResponse("web_push_subscription_save", error);
  return NextResponse.json({ enabled: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const limited = await checkRateLimit(request, { route: "web-push-subscription", limit: 10, extraKeys: [`user:${user.id}`] });
  if (limited) return limited;

  const parsed = endpointSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }
  if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const { error } = await supabase
    .from("web_push_subscriptions")
    .delete()
    .eq("profile_id", user.id)
    .eq("endpoint", parsed.data.endpoint);
  if (error) return dbErrorResponse("web_push_subscription_remove", error);
  return NextResponse.json({ enabled: false });
}
