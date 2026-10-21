import { describe, expect, it } from "vitest";
import { normalizeNigerianNumber } from "./phone";
import {
  communityInviteCsv,
  eligibleCommunityInviteRecipients,
  type CommunityConsentProfile,
} from "./communityInvitations";

const activeConsent = (overrides: Partial<CommunityConsentProfile> = {}): CommunityConsentProfile => ({
  full_name: "Ada Okafor",
  whatsapp_number: "+2348031234567",
  whatsapp_community_invite_opt_in: true,
  whatsapp_community_invite_consented_at: "2026-10-21T12:00:00.000Z",
  whatsapp_community_invite_withdrawn_at: null,
  ...overrides,
});

describe("normalizeNigerianNumber", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["(0803) 123-4567", "+2348031234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeNigerianNumber(input)).toBe(expected);
  });

  it.each(["", "0803123456", "+1 2025550100", "23480312345678", "0803abc4567"])(
    "rejects invalid number %s",
    (input) => expect(normalizeNigerianNumber(input)).toBeNull(),
  );
});

describe("eligibleCommunityInviteRecipients", () => {
  it("requires active, purpose-specific consent and a valid phone number", () => {
    const recipients = eligibleCommunityInviteRecipients([
      activeConsent(),
      activeConsent({ whatsapp_community_invite_opt_in: false }),
      activeConsent({ whatsapp_community_invite_consented_at: null }),
      activeConsent({ whatsapp_community_invite_withdrawn_at: "2026-10-21T13:00:00.000Z" }),
      activeConsent({ whatsapp_number: "not a phone" }),
    ]);
    expect(recipients).toEqual([{ first_name: "Ada", whatsapp_number: "+2348031234567" }]);
  });

  it("does not infer invitation consent from the separate reminder opt-in", () => {
    expect(eligibleCommunityInviteRecipients([activeConsent()])).toHaveLength(1);
  });

  it("deduplicates canonical numbers entered in different formats", () => {
    const recipients = eligibleCommunityInviteRecipients([
      activeConsent(),
      activeConsent({ full_name: "Ada Duplicate", whatsapp_number: "0803 123 4567" }),
    ]);
    expect(recipients).toHaveLength(1);
  });

  it("exports only the minimum columns and supports a missing profile name", () => {
    const csv = communityInviteCsv(eligibleCommunityInviteRecipients([activeConsent({ full_name: null })]));
    expect(csv).toContain('"first_name","whatsapp_number"');
    expect(csv).toContain(`"","'+2348031234567"`);
    expect(csv).not.toMatch(/email|password|profile_id|scholarship/i);
  });

  it("quotes punctuation and neutralizes spreadsheet formulas", () => {
    const csv = communityInviteCsv([
      { first_name: '=HYPERLINK("https://example.com")', whatsapp_number: "+2348031234567" },
    ]);
    expect(csv).toContain(`'=HYPERLINK(""https://example.com"")`);
    expect(csv).toContain("'+2348031234567");
  });

  it("returns a header-only CSV when nobody is eligible", () => {
    expect(communityInviteCsv([])).toContain('"first_name","whatsapp_number"');
    expect(eligibleCommunityInviteRecipients([])).toEqual([]);
  });
});
