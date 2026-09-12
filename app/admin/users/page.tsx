import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/service";
import Link from "next/link";

// app/admin/users/page.tsx
//
// GET /admin/users -- registered-users dashboard.
//
// Lists every auth.users row (service-role paginated listUsers) joined
// with its profiles row for name, completeness, last_seen_at and admin
// flag. Buckets users into three presence states driven entirely by the
// client heartbeat in components/Sidebar.tsx:
//
//   Active   seen in the last 5 minutes
//   Idle     seen 5-30 minutes ago
//   Offline  seen >30 minutes ago, or never
//
// New users appear automatically: migration 0021 adds a trigger on
// auth.users that inserts a profiles row on every signup, so there is
// no separate "add user" step on this page.

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

type Status = "active" | "idle" | "offline";

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  full_name: string | null;
  profile_completeness: number;
  last_seen_at: string | null;
  is_admin: boolean;
  status: Status;
};

function statusFor(lastSeenAt: string | null): Status {
  if (!lastSeenAt) return "offline";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ACTIVE_THRESHOLD_MS) return "active";
  if (diff < IDLE_THRESHOLD_MS) return "idle";
  return "offline";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_TONE: Record<Status, string> = {
  active: "bg-emerald-light text-emerald",
  idle: "bg-amber-light text-amber",
  offline: "bg-hairline text-navy-light",
};
const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  idle: "Idle",
  offline: "Offline",
};
const STATUS_DOT: Record<Status, string> = {
  active: "bg-emerald",
  idle: "bg-amber",
  offline: "bg-navy-light/40",
};

export default async function AdminUsersPage() {
  await requireAdmin();
  const service = createServiceClient();

  // Paginate through every auth user (service role required -- RLS
  // cannot read auth.users from a normal client).
  const authUsers: { id: string; email: string; created_at: string }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (u.email) {
        authUsers.push({ id: u.id, email: u.email, created_at: u.created_at });
      }
    }
    if (data.users.length < 100) break;
    page += 1;
  }

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, profile_completeness, last_seen_at, is_admin");

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users: UserRow[] = authUsers.map((u) => {
    const p = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      full_name: p?.full_name ?? null,
      profile_completeness: p?.profile_completeness ?? 0,
      last_seen_at: p?.last_seen_at ?? null,
      is_admin: Boolean(p?.is_admin),
      status: statusFor(p?.last_seen_at ?? null),
    };
  });

  users.sort((a, b) => {
    const rank: Record<Status, number> = { active: 0, idle: 1, offline: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const at = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bt = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bt - at;
  });

  const counts = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    idle: users.filter((u) => u.status === "idle").length,
    offline: users.filter((u) => u.status === "offline").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Users</h1>
          <p className="text-sm text-navy-light mt-1">
            Every registered account. New users appear automatically when they sign up.
          </p>
        </div>
        <span className="text-xs text-navy-light">
          Active = seen in the last 5 min &middot; Idle = 5-30 min &middot; Offline = 30+ min
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-hairline p-5">
          <p className="font-mono text-3xl font-semibold text-navy">{counts.total}</p>
          <p className="text-sm text-navy-light mt-1">Total registered</p>
        </div>
        <div className="bg-white rounded-xl border border-hairline p-5">
          <p className="font-mono text-3xl font-semibold text-emerald">{counts.active}</p>
          <p className="text-sm text-navy-light mt-1">Active now</p>
        </div>
        <div className="bg-white rounded-xl border border-hairline p-5">
          <p className="font-mono text-3xl font-semibold text-amber">{counts.idle}</p>
          <p className="text-sm text-navy-light mt-1">Idle</p>
        </div>
        <div className="bg-white rounded-xl border border-hairline p-5">
          <p className="font-mono text-3xl font-semibold text-navy-light">{counts.offline}</p>
          <p className="text-sm text-navy-light mt-1">Offline</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        {users.length === 0 ? (
          <p className="text-sm text-navy-light p-5">No registered users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-navy-light">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Last seen</th>
                  <th className="px-5 py-3 font-medium">Profile</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium text-right">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-hairline last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink leading-snug">{u.full_name || "—"}</p>
                      <p className="text-xs text-navy-light">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${STATUS_TONE[u.status]}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[u.status]}`} />
                        {STATUS_LABEL[u.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-navy-light font-mono text-xs">
                      {formatRelative(u.last_seen_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-hairline overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              u.profile_completeness === 100 ? "bg-emerald" : "bg-amber"
                            }`}
                            style={{ width: `${u.profile_completeness}%` }}
                          />
                        </div>
                        <span className="text-xs text-navy-light font-mono">
                          {u.profile_completeness}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-navy-light text-xs">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {u.is_admin ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-light text-amber">
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-navy-light">Student</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
