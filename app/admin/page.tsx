import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function getStats() {
  const supabase = createClient();

  const [{ count: totalScholarships }, { count: verifiedScholarships }, { count: totalProfiles }, { count: totalSaved }] =
    await Promise.all([
      supabase.from("scholarships").select("*", { count: "exact", head: true }),
      supabase.from("scholarships").select("*", { count: "exact", head: true }).eq("verified", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("saved_scholarships").select("*", { count: "exact", head: true }),
    ]);

  const { data: recent } = await supabase
    .from("scholarships")
    .select("id, title, provider_name, deadline, verified, level")
    .order("created_at", { ascending: false })
    .limit(6);

  return {
    totalScholarships: totalScholarships ?? 0,
    verifiedScholarships: verifiedScholarships ?? 0,
    totalProfiles: totalProfiles ?? 0,
    totalSaved: totalSaved ?? 0,
    recent: recent ?? [],
  };
}

export default async function AdminOverviewPage() {
  const stats = await getStats();

  const cards = [
    { label: "Scholarships", value: stats.totalScholarships },
    { label: "Verified & live", value: stats.verifiedScholarships },
    { label: "Students", value: stats.totalProfiles },
    { label: "Saves", value: stats.totalSaved },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Admin overview</h1>
          <p className="text-sm text-navy-light mt-1">Usage at a glance, and the fastest path to add a scholarship.</p>
        </div>
        <Link
          href="/admin/scholarships/new"
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
        >
          + Add scholarship
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-hairline p-5">
            <p className="font-mono text-3xl font-semibold text-navy">{c.value}</p>
            <p className="text-sm text-navy-light mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy">Recently added</h2>
          <Link href="/admin/scholarships" className="text-sm text-navy hover:underline">
            View all
          </Link>
        </div>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-navy-light p-5">No scholarships yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {stats.recent.map((s) => (
                <tr key={s.id} className="border-b border-hairline last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/admin/scholarships/${s.id}/edit`} className="font-medium text-ink hover:text-navy">
                      {s.title}
                    </Link>
                    <p className="text-xs text-navy-light">{s.provider_name}</p>
                  </td>
                  <td className="px-5 py-3 text-navy-light">{s.deadline}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        "text-xs font-medium px-2 py-1 rounded-full " +
                        (s.verified ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber")
                      }
                    >
                      {s.verified ? "Verified" : "Pending review"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
