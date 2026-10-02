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
const DEDUPE_WINDOW_MS = 30_000;
const RELOAD_KEY = "scholars:chunk-recovery";
const reportedRecently = new Map<string, number>();

function clean(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function reportClientError(payload: ErrorPayload): void {
  if (typeof window === "undefined") return;
  try {
    const message = clean(payload.message, MAX_MESSAGE_LENGTH) ?? "Unknown client error";
    const pathname = clean(payload.pathname ?? window.location.pathname, MAX_CONTEXT_LENGTH) ?? "/";
    const signature = `${payload.kind}|${pathname}|${message}`;
    const now = Date.now();
    const previous = reportedRecently.get(signature);
    if (previous && now - previous < DEDUPE_WINDOW_MS) return;
    reportedRecently.set(signature, now);

    // A deploy can leave an already-open tab referring to an old hashed
    // chunk. One automatic retry usually repairs that state; the session key
    // prevents an offline user from entering an infinite reload loop.
    const isChunkFailure = /(?:loading|chunk|dynamic import).*(?:failed|error)|ChunkLoadError/i.test(message);
    if (isChunkFailure) {
      let alreadyRecovered = false;
      try {
        alreadyRecovered = window.sessionStorage.getItem(RELOAD_KEY) === pathname;
      } catch {
        // Storage-blocked browsers simply keep the normal error screen.
      }
      if (!alreadyRecovered) {
        try {
          window.sessionStorage.setItem(RELOAD_KEY, pathname);
        } catch {
          // Best effort only; reporting remains more important than recovery.
        }
        window.setTimeout(() => window.location.reload(), 150);
      }
    }

    const body = JSON.stringify({
      kind: payload.kind,
      message,
      source: clean(payload.source, MAX_CONTEXT_LENGTH),
      pathname,
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
