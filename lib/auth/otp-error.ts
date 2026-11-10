type OtpErrorLike = {
  code?: string | null;
  message?: string | null;
};

/**
 * Supabase returns a machine-readable `otp_expired` code for expired OTPs.
 * Keep the fallback intentionally conservative: an unknown verification
 * failure is reported as invalid rather than claiming that it expired.
 */
export function otpVerificationMessage(error: OtpErrorLike): string {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (code === "otp_expired" || code === "token_expired" || message.includes("otp has expired")) {
    return "That code has expired. Request a new code and try again.";
  }

  return "That code is invalid. Check the six digits and try again.";
}
