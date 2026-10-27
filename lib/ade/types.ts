export type AdeCheckinReason = "clicked" | "deadline_passed";
export type AdeListingKind = "scholarship" | "opportunity";
export type AdePrompt = {
  applicationId: string;
  listingKind: AdeListingKind;
  listingId: string;
  listingTitle: string;
  scholarshipId: string | null;
  scholarshipTitle: string | null;
  reason: AdeCheckinReason;
};
