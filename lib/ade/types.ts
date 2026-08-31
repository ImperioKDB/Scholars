// lib/ade/types.ts
// Shared shape for Ade's (the mascot) next pending check-in prompt. Kept
// standalone since both the API route and the client provider need it, and
// neither should import from the other.

export type AdeCheckinReason = "clicked" | "deadline_passed";

export type AdePrompt = {
  applicationId: string;
  scholarshipId: string;
  scholarshipTitle: string;
  reason: AdeCheckinReason;
};
