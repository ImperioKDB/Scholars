import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/service";
// app/admin/users/page.tsx
// GET /admin/users -- Active Users board (Push E, restores the board that
// was dropped when the admin overview was rewritten).
//
// "Active now" = last_seen_at within ACTIVE_WINDOW_MS (10 min), written by
// the client heartbeat (lib/presence.ts -> /api/presence/heartbeat).
// Idle = seen in last 24h. Offline = older or never.
//
// Emails come from auth.admin.listUsers (service role, paginated) because
// profiles has no email column; profiles supplies completeness / presence.
// Server Component + requireAdmin, so no client data-fetch round trip.
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;
const IDLE_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  profile_completeness: number;
  last_seen_at: string | null;
  created_at: string;
};
function statusOf(lastSeen: string | null, now: number): "active" | "idle" | "offline" {
  if (!lastSeen) return "offline";
  const age = now - Date.parse(lastSeen);
  if (Number.isNaN(age)) return "offline";
  if (age < ACTIVE_WINDOW_MS) return "active";
  if (age < IDLE_WINDOW_MS) return "idle";
  return "offline";
}
function agoLabel(lastSeen: string | null, now: number): string {
  if (!lastSeen) return "never";
  const mins = Math.floor((now - Date.parse(lastSeen)) / 60000);
  if (Number.isNaN(mins) || mins < 0) return "never";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
const CHIP: Record<string, string> = {
  active: "bg-emerald-light text-emerald",
  idle: "bg-amber-light text-amber",
  offline: "bg-hairline text-navy-light",
};
export default async function AdminUsersPage() {
  await requireAdmin();
  const service = createServiceClient();
  const [{ data: profiles }] = await Promise.all([
    service
      .from("profiles")
      .select("id, full_name, profile_completeness, last_seen_at, created_at"),
  ]);
  const emailById = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data } = await service.auth.admin.listUsers({ page, perPage: 100 });
    const users = data?.users ?? [];
    for (const u of users) if (u.id && u.email) emailById.set(u.id, u.email);
    if (users.length < 100) break;
  }
  const now = Date.now();
  const rows: Row[] = ((profiles ?? []) as Row[]).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
  }));
  rows.sort((a, b) => {
    const av = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
    const bv = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
    return bv - av;
  });
  const active = rows.filter((r) => statusOf(r.last_seen_at, now) === "active").length;
  const newThisWeek = rows.filter((r) => now - Date.parse(r.created_at) < WEEK_MS).length;
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Active users</h1>
        <p className="text-sm text-navy-light mt-1">
          Presence from the client heartbeat. Active = seen in the last 10 minutes.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-hairline p-5">
          <p className="font-mono text-3xl font-semibold text-navy">{rows.length}</p>
          <p className="text-sm text-navy-light mt-1">Registered profiles</p>
        </div>
        <div className="bg-white rounded-xl border border-hairline p-5">
          <p className="font-mono text-3xl font-semibold text-emerald">{active}</p>
          <p className="text-sm text-navy-light mt-1">Active now</p>
        </div>
        <div className="bg-white rounded-xl border border-hairline p-5">
          <p className="font-mono text-3xl font-semibold text-navy">{newThisWeek}</p>
          <p className="text-sm text-navy-light mt-1">New this week</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-navy-light">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last seen</th>
                <th className="px-5 py-3 font-medium">Profile</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = statusOf(r.last_seen_at, now);
                return (
                  <tr key={r.id} className="border-b border-hairline last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{r.full_name || "Unnamed"}</p>
                      <p className="text-xs text-navy-light">{r.email || "no email"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${CHIP[st]}`}>
                        {st}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-navy-light">{agoLabel(r.last_seen_at, now)}</td>
                    <td className="px-5 py-3 text-navy-light font-mono">{r.profile_completeness}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
