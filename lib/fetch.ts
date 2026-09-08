// lib/fetch.ts
//
// Fetch wrapper with AbortController timeout.
//
// WHY (audit P1): every fetch() in the app had no timeout. On 2G/3G or a
// hung backend, the UI freezes indefinitely. User stares at spinner,
// assumes app is broken, leaves. This wrapper aborts after `timeoutMs`
// (default 10s) and surfaces a clean error.
//
// USAGE: replace `fetch(url, init)` with `fetchWithTimeout(url, init)`.
// Catches AbortError and rethrows as a friendlier shape for callers.
//
// NOTE: this is for client-side and route-handler fetches. Supabase client
// calls (createClient().from(...)) have their own timeout behavior and
// are not wrapped here.
export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
  }
}

export class FetchNetworkError extends Error {
  constructor(url: string, cause?: unknown) {
    super(`Network request to ${url} failed`);
    this.name = 'FetchNetworkError';
    if (cause) this.cause = cause;
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 10_000, ...fetchInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw new FetchNetworkError(url, error);
  } finally {
    clearTimeout(timer);
  }
}
