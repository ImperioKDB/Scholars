import { describe, expect, it } from "vitest";
import { getAuthRedirectOrigin } from "./redirect-origin";

describe("getAuthRedirectOrigin", () => {
  it("keeps an existing apex PWA on the apex origin", () => {
    expect(
      getAuthRedirectOrigin(
        "https://scholars.com.ng",
        "https://www.scholars.com.ng"
      )
    ).toBe("https://scholars.com.ng");
  });

  it("keeps a www PWA on the www origin", () => {
    expect(
      getAuthRedirectOrigin(
        "https://www.scholars.com.ng",
        "https://scholars.com.ng"
      )
    ).toBe("https://www.scholars.com.ng");
  });

  it("forces HTTPS for custom-domain callbacks", () => {
    expect(
      getAuthRedirectOrigin(
        "http://scholars.com.ng",
        "https://www.scholars.com.ng"
      )
    ).toBe("https://scholars.com.ng");
  });

  it("uses the configured production URL on preview hosts", () => {
    expect(
      getAuthRedirectOrigin(
        "https://scholars-git-feature.vercel.app",
        "https://www.scholars.com.ng/"
      )
    ).toBe("https://www.scholars.com.ng");
  });

  it("falls back to the current origin when no configured URL exists", () => {
    expect(getAuthRedirectOrigin("http://localhost:3000/path")).toBe(
      "http://localhost:3000"
    );
  });
});
