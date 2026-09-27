"use client";

export type ClientErrorKind =
  | "runtime_error"
  | "unhandled_rejection"
  | "route_error"
  | "root_error";

type ErrorPayload = {
  kind: ClientErrorKind;
  message: string;
  source?: string;
  pathname?: string;
  digest?: string;
};

const MAX_MESSAGE_LENGTH = 240;
const MAX_CONTEXT_LENGTH = 240;

function clean(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function reportClientError(payload: ErrorPayload): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      kind: payload.kind,
      message: clean(payload.message, MAX_MESSAGE_LENGTH) ?? "Unknown client error",
      source: clean(payload.source, MAX_CONTEXT_LENGTH),
      pathname: clean(payload.pathname ?? window.location.pathname, MAX_CONTEXT_LENGTH),
      digest: clean(payload.digest, 120),
    });
    void fetch("/api/monitoring/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Monitoring must never throw or block the product.
  }
}
