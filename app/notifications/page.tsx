import { AdeShell } from "@/components/ade/AdeShell";
import { Sidebar } from "@/components/Sidebar";
import { NotificationInbox } from "@/components/NotificationInbox";
import { getCurrentUserAndProfile } from "@/lib/supabase/currentUser";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { profile } = await getCurrentUserAndProfile();
  return (
    <AdeShell>
      <div className="min-h-screen bg-parchment">
        <Sidebar
          fullName={profile?.full_name ?? null}
          isAdmin={Boolean(profile?.is_admin)}
          profileCompleteness={profile?.profile_completeness ?? 0}
          xpTotal={profile?.xp_total ?? 0}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <main id="main" className="md:pl-60">
          <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-10 md:pb-10"><NotificationInbox isAdmin={Boolean(profile?.is_admin)} /></div>
        </main>
      </div>
    </AdeShell>
  );
}
