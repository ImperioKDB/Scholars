export type ConfirmationRequestKind = "signup" | "resend";
export type ConfirmationRequestStatus = "accepted" | "failed";

export async function recordConfirmationEmailEvent(params: {
  email: string;
  kind: ConfirmationRequestKind;
  status: ConfirmationRequestStatus;
  userId?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  try {
    await fetch("/api/auth/confirmation-email-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      keepalive: true,
    });
  } catch {
    // Observability must never block signup, login, or resend flows.
  }
}
