import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  kind: z.enum(["runtime_error", "unhandled_rejection", "route_error", "root_error"]),
  message: z.string().trim().min(1).max(240),
  source: z.string().trim().max(240).optional(),
  pathname: z.string().trim().max(240).optional(),
  digest: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: "monitoring-errors", limit: 20 });
  if (limited) return limited;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid monitoring payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("monitoring_error_events").insert({
    profile_id: user?.id ?? null,
    kind: parsed.data.kind,
    message: parsed.data.message,
    source: parsed.data.source ?? null,
    pathname: parsed.data.pathname ?? null,
    digest: parsed.data.digest ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "Could not record monitoring event" }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
