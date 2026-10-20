// Shared network wrapper for browser, server and Supabase requests.
// GET/HEAD retries are opt-in and capped at one; mutations are never retried here.
export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

export class FetchNetworkError extends Error {
  constructor(url: string, cause?: unknown) {
    super(`Network request to ${url} failed`);
    this.name = "FetchNetworkError";
    if (cause) this.cause = cause;
  }
}

type TimeoutRequestInit = RequestInit & {
  timeoutMs?: number;
  retries?: number;
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if ("url" in input) return input.url;
  return input.href;
}

function requestSignal(input: RequestInfo | URL, initSignal?: AbortSignal | null) {
  if (initSignal) return initSignal;
  return typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined;
}

function signalNetworkIssue(kind: "timeout" | "network") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("scholars:network-issue", { detail: { kind } }));
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: TimeoutRequestInit = {}
): Promise<Response> {
  const { timeoutMs = 10_000, retries = 0, signal: initSignal, ...fetchInit } = init;
  const url = requestUrl(input);
  const callerSignal = requestSignal(input, initSignal);
  const method = (fetchInit.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
  const safeRead = method === "GET" || method === "HEAD";
  const maxRetries = safeRead ? Math.min(1, Math.max(0, Math.floor(retries))) : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener("abort", onExternalAbort, { once: true });
    }

    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let retryResponse = false;
    try {
      const response = await fetch(input, { ...fetchInit, signal: controller.signal });
      retryResponse = response.status >= 500 && attempt < maxRetries;
      if (!retryResponse) return response;
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      const normalized = timedOut ? new FetchTimeoutError(url, timeoutMs) : new FetchNetworkError(url, error);
      if (attempt < maxRetries) {
        // Only safe reads reach this path; the next attempt gets a fresh controller.
      } else {
        signalNetworkIssue(timedOut ? "timeout" : "network");
        throw normalized;
      }
    } finally {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onExternalAbort);
    }

    if (retryResponse || attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw new FetchNetworkError(url);
}

export function createTimeoutFetch(timeoutMs = 15_000): typeof fetch {
  return (input, init) => fetchWithTimeout(input, { ...init, timeoutMs });
}
