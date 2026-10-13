import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "./manifest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PWA manifest origin", () => {
  it("uses the canonical production origin for the app id, launch URL, and scope", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.scholars.com.ng/");

    const result = manifest();

    expect(result.id).toBe("https://www.scholars.com.ng/");
    expect(result.start_url).toBe("https://www.scholars.com.ng/dashboard");
    expect(result.scope).toBe("https://www.scholars.com.ng/");
  });

  it("keeps development and preview installs on their own origin", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.scholars.com.ng/");

    const result = manifest();

    expect(result.id).toBe("/");
    expect(result.start_url).toBe("/dashboard");
    expect(result.scope).toBe("/");
  });
});
