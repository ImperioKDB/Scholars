import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/admin/guard";
import { checkRateLimit } from "@/lib/ratelimit";
import { getCommunityInvitationRecipients } from "@/lib/admin/community-invitations";
import { communityInviteCsv } from "@/lib/whatsapp/communityInvitations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const founder = await assertAdmin(supabase, { requireFounder: true });
  if (!founder.ok) return founder.response;

  const limited = await checkRateLimit(request, {
    route: "admin-community-invitation-export",
    limit: 5,
    extraKeys: [`user:${founder.userId}`],
  });
  if (limited) return limited;

  try {
    const recipients = await getCommunityInvitationRecipients();
    return new Response(communityInviteCsv(recipients), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="scholars-community-invitations.csv"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Vary": "Cookie",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Community invitation export is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
