// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const oldEndpoint = "https://fcm.googleapis.com/old";
const newEndpoint = "https://fcm.googleapis.com/new";
const otherDevice = "https://fcm.googleapis.com/other-device";
const db = vi.hoisted(() => ({
  user: null as string | null,
  rows: new Set<string>(),
  failSave: false,
  failRetirement: false,
}));

vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: async () => null }));
vi.mock("@/lib/errors", () => ({ dbErrorResponse: () => new Response(null, { status: 500 }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user ? { id: db.user } : null } }) },
    from: (table: string) => {
      expect(table).toBe("web_push_subscriptions");
      return {
        upsert: async ({ profile_id, endpoint }: { profile_id: string; endpoint: string }) => {
          if (db.failSave) return { error: new Error("save failed") };
          db.rows.add(profile_id + " " + endpoint);
          return { error: null };
        },
        delete: () => ({
          eq: (ownerColumn: string, owner: string) => ({
            eq: async (endpointColumn: string, endpoint: string) => {
              expect(ownerColumn).toBe("profile_id");
              expect(endpointColumn).toBe("endpoint");
              expect(db.rows.has(owner + " " + newEndpoint)).toBe(true);
              if (db.failRetirement) return { error: new Error("retirement failed") };
              db.rows.delete(owner + " " + endpoint);
              return { error: null };
            },
          }),
        }),
      };
    },
  }),
}));

function replace(replacedEndpoint = oldEndpoint) {
  return POST(new Request("https://scholars.example/api/push/subscription", {
    method: "POST",
    body: JSON.stringify({
      endpoint: newEndpoint, replacedEndpoint, profileId: alice,
      keys: { p256dh: "a".repeat(40), auth: "b".repeat(10) },
    }),
  }));
}

beforeEach(() => {
  db.user = alice;
  db.failSave = false;
  db.failRetirement = false;
  db.rows = new Set([`${alice} ${oldEndpoint}`, `${bob} ${oldEndpoint}`, `${alice} ${otherDevice}`]);
});

it("retires only the requesting account's replaced endpoint after saving", async () => {
  expect((await replace()).status).toBe(200);
  expect(db.rows).toEqual(new Set([`${alice} ${newEndpoint}`, `${bob} ${oldEndpoint}`, `${alice} ${otherDevice}`]));
});

it("requires authentication and preserves existing rows when the upsert fails", async () => {
  const initial = new Set(db.rows);
  db.user = null;
  expect((await replace()).status).toBe(401);
  db.user = alice;
  db.failSave = true;
  expect((await replace()).status).toBe(500);
  expect(db.rows).toEqual(initial);
});

it("rejects a stale tab's request after the authenticated account changes", async () => {
  const initial = new Set(db.rows);
  db.user = bob;
  expect((await replace()).status).toBe(403);
  expect(db.rows).toEqual(initial);
});

it("supports idempotent retirement retries and a reused endpoint", async () => {
  db.failRetirement = true;
  expect((await replace()).status).toBe(500);
  expect(db.rows.has(`${alice} ${newEndpoint}`)).toBe(true);
  expect(db.rows.has(`${alice} ${oldEndpoint}`)).toBe(true);
  db.failRetirement = false;
  expect((await replace()).status).toBe(200);
  expect((await replace()).status).toBe(200);
  expect((await replace(newEndpoint)).status).toBe(200);
  expect(db.rows.has(`${alice} ${newEndpoint}`)).toBe(true);
});
