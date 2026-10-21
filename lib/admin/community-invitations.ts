import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  eligibleCommunityInviteRecipients,
  type CommunityConsentProfile,
  type CommunityInviteRecipient,
} from "@/lib/whatsapp/communityInvitations";

const PAGE_SIZE = 1000;
const MAX_CONSENTED_PROFILES = 10_000;

async function loadActiveConsents(includeName: boolean): Promise<CommunityConsentProfile[]> {
  const service = createServiceClient();
  const columns = includeName
    ? "full_name, whatsapp_number, whatsapp_community_invite_opt_in, whatsapp_community_invite_consented_at, whatsapp_community_invite_withdrawn_at"
    : "whatsapp_number, whatsapp_community_invite_opt_in, whatsapp_community_invite_consented_at, whatsapp_community_invite_withdrawn_at";
  const profiles: CommunityConsentProfile[] = [];
  let expectedCount = 0;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, count, error } = await service
      .from("profiles")
      .select(columns, { count: "exact" })
      .eq("whatsapp_community_invite_opt_in", true)
      .not("whatsapp_community_invite_consented_at", "is", null)
      .is("whatsapp_community_invite_withdrawn_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error("Community invitation consent records are unavailable");
    if (offset === 0) {
      expectedCount = count ?? 0;
      if (expectedCount > MAX_CONSENTED_PROFILES) {
        throw new Error("Community invitation recipient count exceeds the safe export limit");
      }
    }

    const page = (data ?? []) as unknown as CommunityConsentProfile[];
    profiles.push(...page);
    if (profiles.length >= expectedCount || page.length < PAGE_SIZE) break;
  }

  if (profiles.length < expectedCount) {
    throw new Error("Community invitation consent list could not be read completely");
  }
  return profiles;
}

async function reminderOptInCount(): Promise<number> {
  const service = createServiceClient();
  const { count, error } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp_opt_in", true);
  if (error) throw new Error("WhatsApp reminder opt-in count is unavailable");
  return count ?? 0;
}

export async function getCommunityInvitationSummary(): Promise<{
  reminderOptInCount: number;
  activeConsentProfileCount: number;
  eligibleRecipientCount: number;
}> {
  const [reminderOptIns, activeProfiles] = await Promise.all([
    reminderOptInCount(),
    loadActiveConsents(false),
  ]);
  const recipients = eligibleCommunityInviteRecipients(activeProfiles);
  return {
    reminderOptInCount: reminderOptIns,
    activeConsentProfileCount: activeProfiles.length,
    eligibleRecipientCount: recipients.length,
  };
}

export async function getCommunityInvitationRecipients(): Promise<CommunityInviteRecipient[]> {
  const profiles = await loadActiveConsents(true);
  return eligibleCommunityInviteRecipients(profiles);
}
