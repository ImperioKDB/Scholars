import { describe, expect, it, vi } from "vitest";
import { assertAdmin } from "./guard";

function fakeSupabase({
  user = { id: "user-1" },
  profile = { is_admin: true, community_role: "founder" },
  authError = null,
}: {
  user?: { id: string } | null;
  profile?: { is_admin: boolean; community_role: string } | null;
  authError?: Error | null;
} = {}) {
  const single = vi.fn().mockResolvedValue({ data: profile, error: null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }),
        mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
      },
      from: vi.fn(() => ({ select })),
    } as never,
    single,
  };
}

describe("assertAdmin founder gate", () => {
  it("allows an authenticated admin whose community role is founder", async () => {
    const { client } = fakeSupabase();
    await expect(assertAdmin(client, { requireFounder: true })).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });
  });

  it("rejects ordinary admins from founder-only access", async () => {
    const { client } = fakeSupabase({ profile: { is_admin: true, community_role: "contributor" } });
    const result = await assertAdmin(client, { requireFounder: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("rejects a founder role without the protected admin flag", async () => {
    const { client } = fakeSupabase({ profile: { is_admin: false, community_role: "founder" } });
    const result = await assertAdmin(client, { requireFounder: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("rejects unauthenticated requests before profile role lookup", async () => {
    const { client, single } = fakeSupabase({ user: null });
    const result = await assertAdmin(client, { requireFounder: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(single).not.toHaveBeenCalled();
  });
});
