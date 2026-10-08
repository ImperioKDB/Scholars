import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/errors";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["pwa_installed", "push_enable_clicked"]),
});

async function getUserAndClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function GET() {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data, error } = await supabase
    .from("profiles")
    .select("pwa_installed_at, push_enable_clicked_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return dbErrorResponse("onboarding/prompts", error);
  return NextResponse.json({
    pwaInstalledAt: data?.pwa_installed_at ?? null,
    pushEnableClickedAt: data?.push_enable_clicked_at ?? null,
  });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid prompt action" }, { status: 400 });
  const column = parsed.data.action === "pwa_installed" ? "pwa_installed_at" : "push_enable_clicked_at";
  const { error } = await supabase
    .from("profiles")
    .update({ [column]: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return dbErrorResponse("onboarding/prompts", error);
  return NextResponse.json({ ok: true });
}
