export const OTP_LENGTH = 6;

export function distributeOtpInput(
  current: string[],
  startIndex: number,
  rawValue: string,
): string[] {
  const digits = rawValue.replace(/\D/g, "").slice(0, OTP_LENGTH);
  const next = [...current];

  if (!digits) {
    next[startIndex] = "";
    return next;
  }

  digits.split("").forEach((digit, offset) => {
    if (startIndex + offset < OTP_LENGTH) next[startIndex + offset] = digit;
  });

  return next;
}
