import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "./manifest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PWA manifest origin", () => {
  it("keeps production installs on the host that served the manifest", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.scholars.com.ng/");

    const result = manifest();

    expect(result.id).toBe("/");
    expect(result.start_url).toBe("/dashboard");
    expect(result.scope).toBe("/");
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
