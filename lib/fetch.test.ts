import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchNetworkError, FetchTimeoutError, fetchWithTimeout } from "./fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("retries a failed GET once when explicitly requested", async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const responsePromise = fetchWithTimeout("/api/read", { retries: 1 });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a mutation even when retries are requested", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchWithTimeout("/api/write", { method: "POST", retries: 1 }))
      .rejects.toBeInstanceOf(FetchNetworkError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("classifies a timed-out request", async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const request = fetchWithTimeout("/api/slow", { timeoutMs: 100 });
    const assertion = expect(request).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});
