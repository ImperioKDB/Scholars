import { describe, expect, it } from "vitest";
import { mergeSupabaseSessionCookies } from "./pwa-session";

describe("Supabase session cookies for legacy PWA migration", () => {
  it("keeps the base session cookie and every numbered chunk only", () => {
    expect(
      mergeSupabaseSessionCookies([
        { name: "sb-project123-auth-token", value: "base" },
        { name: "sb-project123-auth-token.0", value: "chunk-0" },
        { name: "sb-project123-auth-token.1", value: "chunk-1" },
        { name: "sb-project123-auth-token-code-verifier", value: "pkce" },
        { name: "scholars_consent", value: "accepted" },
      ])
    ).toEqual([
      { name: "sb-project123-auth-token", value: "base" },
      { name: "sb-project123-auth-token.0", value: "chunk-0" },
      { name: "sb-project123-auth-token.1", value: "chunk-1" },
    ]);
  });

  it("uses refreshed cookie values over stale request values", () => {
    expect(
      mergeSupabaseSessionCookies(
        [{ name: "sb-project123-auth-token.0", value: "old" }],
        [{ name: "sb-project123-auth-token.0", value: "refreshed" }]
      )
    ).toEqual([{ name: "sb-project123-auth-token.0", value: "refreshed" }]);
  });

  it("retains empty refreshed chunks so deleted cookies are cleared", () => {
    expect(
      mergeSupabaseSessionCookies(
        [{ name: "sb-project123-auth-token.1", value: "stale" }],
        [{ name: "sb-project123-auth-token.1", value: "" }]
      )
    ).toEqual([{ name: "sb-project123-auth-token.1", value: "" }]);
  });
});
