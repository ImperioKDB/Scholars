// Normalize Nigerian mobile numbers into the format accepted by the current
// WhatsApp preference flow. This validates shape, not whether a number has an
// active WhatsApp account.
export function normalizeNigerianNumber(raw: string): string | null {
  const digits = raw.trim().replace(/[\s()-]/g, "");
  let normalized = digits;
  if (digits.startsWith("0")) normalized = "+234" + digits.slice(1);
  else if (digits.startsWith("+234")) normalized = digits;
  else if (digits.startsWith("234")) normalized = "+" + digits;
  else return null;
  return /^\+234\d{10}$/.test(normalized) ? normalized : null;
}
