import { describe, expect, it } from "vitest";

// next.config.js is CommonJS and intentionally remains outside TypeScript's
// source include; this test verifies the framework-level redirect contract.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require("../next.config.js") as {
  redirects: () => Promise<Array<{
    source: string;
    has?: Array<{ type: string; value: string }>;
    destination: string;
    permanent: boolean;
  }>>;
};

describe("canonical host redirect", () => {
  it("permanently redirects the apex host while preserving the path", async () => {
    const rules = await nextConfig.redirects();
    expect(rules).toContainEqual({
      source: "/:path*",
      has: [{ type: "host", value: "scholars.com.ng" }],
      destination: "https://www.scholars.com.ng/:path*",
      permanent: true,
    });
  });
});
