import { describe, expect, it } from "vitest";
import { clientIp } from "./ratelimit";

describe("clientIp", () => {
  it("prefers the Cloudflare visitor IP", () => {
    const request = new Request("https://www.scholars.com.ng/api/test", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "x-vercel-forwarded-for": "203.0.113.20",
        "x-real-ip": "203.0.113.30",
      },
    });

    expect(clientIp(request)).toBe("203.0.113.10");
  });

  it("uses the Vercel forwarding header when Cloudflare IP is absent", () => {
    const request = new Request("https://www.scholars.com.ng/api/test", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.20, 10.0.0.1",
      },
    });

    expect(clientIp(request)).toBe("203.0.113.20");
  });

  it("uses x-real-ip as a fallback", () => {
    const request = new Request("https://www.scholars.com.ng/api/test", {
      headers: { "x-real-ip": "203.0.113.30" },
    });

    expect(clientIp(request)).toBe("203.0.113.30");
  });

  it("does not trust x-forwarded-for", () => {
    const request = new Request("https://www.scholars.com.ng/api/test", {
      headers: { "x-forwarded-for": "198.51.100.99" },
    });

    expect(clientIp(request)).toBe("unknown");
  });

  it("ignores empty trusted IP headers", () => {
    const request = new Request("https://www.scholars.com.ng/api/test", {
      headers: {
        "cf-connecting-ip": " ",
        "x-vercel-forwarded-for": " ",
        "x-real-ip": " ",
        "x-forwarded-for": "198.51.100.99",
      },
    });

    expect(clientIp(request)).toBe("unknown");
  });
});
