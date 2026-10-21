import { normalizeNigerianNumber } from "./phone";

export type CommunityConsentProfile = {
  full_name?: string | null;
  whatsapp_number: string | null;
  whatsapp_community_invite_opt_in: boolean | null;
  whatsapp_community_invite_consented_at: string | null;
  whatsapp_community_invite_withdrawn_at: string | null;
};

export type CommunityInviteRecipient = {
  first_name: string;
  whatsapp_number: string;
};

export function eligibleCommunityInviteRecipients(
  profiles: CommunityConsentProfile[],
): CommunityInviteRecipient[] {
  const seenNumbers = new Set<string>();
  const recipients: CommunityInviteRecipient[] = [];

  for (const profile of profiles) {
    if (
      profile.whatsapp_community_invite_opt_in !== true ||
      !profile.whatsapp_community_invite_consented_at ||
      profile.whatsapp_community_invite_withdrawn_at
    ) {
      continue;
    }

    const phone = normalizeNigerianNumber(profile.whatsapp_number ?? "");
    if (!phone || seenNumbers.has(phone)) continue;
    seenNumbers.add(phone);

    const name = profile.full_name?.trim() ?? "";
    recipients.push({ first_name: name ? name.split(/\s+/)[0] : "", whatsapp_number: phone });
  }
  return recipients;
}

function csvCell(value: string): string {
  // Prefix formula-leading values (including + phone numbers) with an
  // apostrophe so opening the CSV in spreadsheet software cannot execute it.
  const safe = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function communityInviteCsv(recipients: CommunityInviteRecipient[]): string {
  const rows = [
    ["first_name", "whatsapp_number"],
    ...recipients.map((recipient) => [recipient.first_name, recipient.whatsapp_number]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
