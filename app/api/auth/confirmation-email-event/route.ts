import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { createServiceClient } from "@/lib/supabase/service";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  kind: z.enum(["signup", "resend"]),
  status: z.enum(["accepted", "failed"]),
  userId: z.string().uuid().nullable().optional(),
  errorCode: z.string().trim().max(120).nullable().optional(),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: "auth-confirmation-event", limit: 30 });
  if (limited) return limited;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid confirmation event" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const service = createServiceClient();
  const { error } = await service.from("auth_confirmation_email_events").insert({
    user_id: parsed.data.userId ?? null,
    email_hash: createHash("sha256").update(email).digest("hex"),
    email_domain: email.split("@").pop() ?? "unknown",
    request_kind: parsed.data.kind,
    request_status: parsed.data.status,
    error_code: parsed.data.errorCode || null,
  });

  if (error) {
    return NextResponse.json({ error: "Could not record confirmation event" }, { status: 500 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
