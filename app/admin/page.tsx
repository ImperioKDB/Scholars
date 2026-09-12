import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SendDigestButton } from "@/components/admin/SendDigestButton";
import { SendProfileNudgesButton } from "@/components/admin/SendProfileNudgesButton";
// Activation funnel window for the scoreboard below. 30 days matches how
// often you actually look at this page and how long a signup cohort stays
// relevant during an application cycle.
const ACTIVATION_WINDOW_DAYS = 30;
async function getStats() {
  const supabase = createClient();
  const sinceIso = new Date(Date.now() - ACTIVATION_WINDOW_DAYS * 86400000).toISOString();
  const [
    { count: totalScholarships },
    { count: verifiedScholarships },
    { count: totalProfiles },
    { count: totalSaved },
    { count: incompleteProfiles },
    lastLog,
    lastNudge,
    { data: eventRows },
  ] = await Promise.all([
    supabase.from("scholarships").select("*", { count: "exact", head: true }),
    supabase.from("scholarships").select("*", { count: "exact", head: true }).eq("verified", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("saved_scholarships").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).lt("profile_completeness", 100),
    supabase
      .from("announcement_log")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("profiles")
      .select("profile_reminder_last_sent_at")
      .not("profile_reminder_last_sent_at", "is", null)
      .order("profile_reminder_last_sent_at", { ascending: false })
      .limit(1),
    // Activation funnel (Phase 1, migration 0019). Degrades to zeroes
    // pre-migration: the select errors and eventRows stays null.
    supabase.from("events").select("event").gte("created_at", sinceIso),
  ]);
  const activation: Record<string, number> = {
    profile_created: 0,
    provisional_matches_viewed: 0,
    gap_nudge_clicked: 0,
    profile_completed: 0,
    whatsapp_opt_in: 0,
  };
  for (const row of eventRows ?? []) {
    if (typeof row.event === "string" && row.event in activation) {
      activation[row.event] += 1;
    }
  }
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
    incompleteProfiles: incompleteProfiles ?? 0,
    lastDigestAt: (lastLog?.data?.[0]?.created_at as string | undefined) ?? null,
    lastNudgeAt:
      (lastNudge?.data?.[0]?.profile_reminder_last_sent_at as string | undefined) ?? null,
    activation,
    recent: recent ?? [],
  };
}
export default async function AdminOverviewPage() {
  const stats = await getStats();
  const cards = [
    { label: "Scholarships", value: stats.totalScholarships },
    { label: "Verified & live", value: stats.verifiedScholarships },
    { label: "Students", value: stats.totalProfiles },
    { label: "Incomplete profiles", value: stats.incompleteProfiles },
    { label: "Saves", value: stats.totalSaved },
  ];
  const activationCards = [
    { label: "Profiles created", value: stats.activation.profile_created },
    { label: "Saw first matches", value: stats.activation.provisional_matches_viewed },
    { label: "Nudge clicks", value: stats.activation.gap_nudge_clicked },
    { label: "Completed profile", value: stats.activation.profile_completed },
    { label: "WhatsApp opt-ins", value: stats.activation.whatsapp_opt_in },
  ];
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Admin overview</h1>
          <p className="text-sm text-navy-light mt-1">Usage at a glance, and the fastest path to add a scholarship.</p>
        </div>
        <Link
          href="/admin/scholarships/new"
          className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          + Add scholarship
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-hairline p-5">
            <p className="font-mono text-3xl font-semibold text-navy">{c.value}</p>
            <p className="text-sm text-navy-light mt-1">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-hairline p-5 mb-10">
        <h2 className="font-display text-lg font-semibold text-navy mb-1">
          Activation, last {ACTIVATION_WINDOW_DAYS} days
        </h2>
        <p className="text-sm text-navy-light mb-4">
          The signup-to-completion funnel: first profile save, first look at real matches,
          gap-nudge clicks, profiles that reached 100%, and WhatsApp consent. Reads the
          events table, so it stays empty until students start generating events.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {activationCards.map((c) => (
            <div key={c.label} className="bg-parchment rounded-xl border border-hairline p-4">
              <p className="font-mono text-2xl font-semibold text-navy">{c.value}</p>
              <p className="text-xs text-navy-light mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-hairline p-5 mb-10">
        <h2 className="font-display text-lg font-semibold text-navy mb-1">New-listing email digest</h2>
        <p className="text-sm text-navy-light mb-4">
          Bundles every verified scholarship and opportunity added in the last 7 days into one email
          per student, skipping anything they have already been told about. The scheduled job runs
          daily at 9:00am Nigeria time; press this to send immediately after adding listings. Each
          listing reaches each student at most once, so pressing twice the same day only sends what
          was verified since the first press.
        </p>
        <SendDigestButton lastDigestAt={stats.lastDigestAt} />
      </div>
      <div className="bg-white rounded-xl border border-hairline p-5 mb-10">
        <h2 className="font-display text-lg font-semibold text-navy mb-1">Profile completion reminders</h2>
        <p className="text-sm text-navy-light mb-4">
          Emails students whose profile is under 100%, naming the exact fields they&apos;re missing so
          they know what to add. The scheduled job runs daily at 9:00am Nigeria time, at most once
          every 2 days per student, and stops after 5 emails. The navy button runs the same pass
          immediately, skipping anyone reminded in the last 2 days. The outlined button overrides
          both guards and emails every incomplete profile right now, for one-off campaigns only.
        </p>
        <SendProfileNudgesButton lastNudgeAt={stats.lastNudgeAt} />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
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
          </div>
        )}
      </div>
    </div>
  );
}
