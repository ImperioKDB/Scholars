import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { assertAdmin } from "@/lib/admin/guard";
import { checkRateLimit } from "@/lib/ratelimit";
import { logError, logWarn } from "@/lib/logging";
import { renderNigeriaIndependenceDayGreeting } from "@/lib/email/template";
import { sendEmail } from "@/lib/email/send";

export const maxDuration = 300;

const ROUTE = "/api/admin/independence-day";
const CAMPAIGN_ID = "00000000-0000-4000-8000-000000000001";
const SEND_CONCURRENCY = 5;
const MAX_ATTEMPTS = 3;

type Recipient = { id: string; email: string; fullName: string | null };

function nigeriaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isIndependenceDay(): boolean {
  return nigeriaDateKey() === "2026-10-01";
}

async function listRecipients(service: ReturnType<typeof createServiceClient>): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email) {
        recipients.push({
          id: user.id,
          email: user.email,
          fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
        });
      }
    }
    if (users.length < 100) break;
    page += 1;
  }
  return recipients;
}

async function sendWithRetry(params: { to: string; subject: string; html: string; text: string }) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await sendEmail({ ...params, manual: true });
      if (result.dry) throw new Error("Email sending is not configured on the server.");
      return { attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function GET() {
  const supabase = await createClient();
  const guard = await assertAdmin(supabase);
  if (!guard.ok) return guard.response;

  const service = createServiceClient();
  const { count, error } = await service
    .from("broadcast_delivery_log")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", CAMPAIGN_ID)
    .eq("status", "sent");
  if (error) return NextResponse.json({ error: "Couldn't check campaign status." }, { status: 500 });

  let recipientCount: number | null = null;
  try {
    recipientCount = (await listRecipients(service)).length;
  } catch {
    // The button can still render with an unknown count; POST reports failures honestly.
  }

  return NextResponse.json({
    available: isIndependenceDay(),
    alreadySent: (count ?? 0) > 0,
    sent: count ?? 0,
    recipientCount,
  });
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { route: "admin-independence-day", limit: 1 });
  if (limited) return limited;

  const supabase = await createClient();
  const guard = await assertAdmin(supabase);
  if (!guard.ok) return guard.response;
  if (!isIndependenceDay()) {
    return NextResponse.json({ error: "This campaign is only available on Nigeria's Independence Day." }, { status: 409 });
  }
  if (!process.env.BREVO_API_KEY || !process.env.REMINDER_FROM_EMAIL) {
    return NextResponse.json({ error: "Email sending is not configured on Vercel. Add BREVO_API_KEY and REMINDER_FROM_EMAIL first." }, { status: 503 });
  }

  const service = createServiceClient();
  const { count: alreadySent, error: statusError } = await service
    .from("broadcast_delivery_log")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", CAMPAIGN_ID)
    .eq("status", "sent");
  if (statusError) return NextResponse.json({ error: "Couldn't check whether this campaign was already sent." }, { status: 500 });
  if ((alreadySent ?? 0) > 0) return NextResponse.json({ error: "The Independence Day email has already been sent." }, { status: 409 });

  let recipients: Recipient[];
  try {
    recipients = await listRecipients(service);
  } catch (error) {
    logError(ROUTE, "recipient_load_failed", {}, error);
    return NextResponse.json({ error: "Couldn't load registered student emails." }, { status: 500 });
  }
  if (recipients.length === 0) return NextResponse.json({ error: "No registered student emails found." }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  let sent = 0;
  let failed = 0;
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const index = nextIndex++;
      if (index >= recipients.length) return;
      const recipient = recipients[index];
      const firstName = recipient.fullName?.trim().split(/\s+/)[0] || recipient.email.split("@")[0];
      const email = renderNigeriaIndependenceDayGreeting({ firstName, baseUrl });
      try {
        const outcome = await sendWithRetry({ to: recipient.email, ...email });
        sent += 1;
        await service.from("broadcast_delivery_log").insert({
          broadcast_id: CAMPAIGN_ID,
          recipient_email: recipient.email,
          recipient_user_id: recipient.id,
          status: "sent",
          attempts: outcome.attempts,
        });
      } catch (error) {
        failed += 1;
        logError(ROUTE, "send_failed", { email: recipient.email }, error);
        const message = error instanceof Error ? error.message : String(error);
        await service.from("broadcast_delivery_log").insert({
          broadcast_id: CAMPAIGN_ID,
          recipient_email: recipient.email,
          recipient_user_id: recipient.id,
          status: "failed",
          attempts: MAX_ATTEMPTS,
          error_message: message,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, recipients.length) }, () => worker()));
  logWarn(ROUTE, "campaign_complete", { campaign: "nigeria-independence-day-2026", sent, failed, recipients: recipients.length });
  return NextResponse.json({ sent, failed, recipients: recipients.length });
}
