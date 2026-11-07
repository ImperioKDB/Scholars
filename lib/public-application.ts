const ALLOWED_APPLICATION_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export type PublicApplicationLink = {
  href: string;
  label: string;
};

export function getSafeApplicationUrl(value: string | null | undefined): URL | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    return ALLOWED_APPLICATION_PROTOCOLS.has(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function getApplicationLinkLabel({
  closed,
  protocol,
}: {
  closed: boolean;
  protocol: string;
}): string {
  if (closed) return "View application destination for historical information";
  if (protocol === "mailto:") return "Contact the provider by email";
  return "Open application destination";
}
