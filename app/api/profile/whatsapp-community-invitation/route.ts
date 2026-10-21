import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/ratelimit";
import { normalizeNigerianNumber } from "@/lib/whatsapp/phone";

const NOTICE_VERSION = "community-invite-v1";
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("grant"),
    consented: z.literal(true),
    whatsapp_number: z.string().trim().min(1).max(24),
  }).strict(),
  z.object({ action: z.literal("withdraw") }).strict(),
]);

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "Not authenticated" }, 401);

  const limited = await checkRateLimit(request, {
    route: "whatsapp-community-consent",
    limit: 20,
    extraKeys: [`user:${user.id}`],
  });
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid consent request" }, 400);
  const service = createServiceClient();

  if (parsed.data.action === "withdraw") {
    const { data: current, error: readError } = await service
      .from("profiles")
      .select("whatsapp_community_invite_opt_in")
      .eq("id", user.id)
      .maybeSingle();
    if (readError) return json({ error: "Could not update consent" }, 500);
    if (!current) return json({ error: "Profile not found" }, 404);

    if (current.whatsapp_community_invite_opt_in === true) {
      const { error } = await service
        .from("profiles")
        .update({
          whatsapp_community_invite_opt_in: false,
          whatsapp_community_invite_withdrawn_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) return json({ error: "Could not update consent" }, 500);
    }
    return json({ opted_in: false });
  }

  const number = normalizeNigerianNumber(parsed.data.whatsapp_number);
  if (!number) return json({ error: "Enter a valid Nigerian mobile number" }, 400);

  const { data, error } = await service
    .from("profiles")
    .update({
      whatsapp_number: number,
      whatsapp_community_invite_opt_in: true,
      whatsapp_community_invite_consented_at: new Date().toISOString(),
      whatsapp_community_invite_withdrawn_at: null,
      whatsapp_community_invite_notice_version: NOTICE_VERSION,
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return json({ error: "Could not save consent" }, 500);
  if (!data) return json({ error: "Profile not found" }, 404);
  return json({ opted_in: true });
}
