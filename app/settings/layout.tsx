import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import SettingsPage from "./page";

export default async function SettingsLayout() {
  const { user, profile } = await getCurrentUserAndProfile();
  const fullName = profile?.full_name ?? null;
  const isAdmin = Boolean(profile?.is_admin);
  const profileCompleteness = profile?.profile_completeness ?? 0;
  const xpTotal = profile?.xp_total ?? 0;
  const avatarUrl = profile?.avatar_url ?? null;

  // Settings page needs the full profile row + WAEC results to render
  // read-only. Fetching here (server-side, once per render) keeps the
  // page itself as a pure client component that can own the delete
  // confirm dialog state.
  let settingsProps: {
    profile: Parameters<typeof SettingsPage>[0]["profile"];
    waecRows: Parameters<typeof SettingsPage>[0]["waecRows"];
    userEmail: string;
  } = { profile: null, waecRows: [], userEmail: user?.email ?? "" };

  if (user) {
    const supabase = createClient();
    const [{ data: profileRow }, { data: waec }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("waec_results")
        .select("subject, grade")
        .eq("profile_id", user.id)
        .order("subject", { ascending: true }),
    ]);
    settingsProps = {
      profile: profileRow as Parameters<typeof SettingsPage>[0]["profile"],
      waecRows: (waec ?? []) as Parameters<typeof SettingsPage>[0]["waecRows"],
      userEmail: user.email ?? "",
    };
  }

  return (
    <div className="min-h-screen bg-parchment">
      <Sidebar fullName={fullName} isAdmin={isAdmin} profileCompleteness={profileCompleteness} xpTotal={xpTotal} avatarUrl={avatarUrl} />
      <main id="main" className="md:pl-60">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 md:pt-10 md:pb-10">
          <SettingsPage {...settingsProps} />
        </div>
      </main>
    </div>
  );
}
