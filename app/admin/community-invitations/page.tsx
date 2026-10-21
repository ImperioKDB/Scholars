import { requireAdmin } from "@/lib/admin/access";
import { getCommunityInvitationSummary } from "@/lib/admin/community-invitations";
import { CommunityInvitationMessage } from "@/components/admin/CommunityInvitationMessage";

export const dynamic = "force-dynamic";

export default async function CommunityInvitationsPage() {
  await requireAdmin({ requireFounder: true });
  const summary = await getCommunityInvitationSummary();

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber">Founder only</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-navy">WhatsApp community invitations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy-light">
          This is a manual invitation workflow. Only a separate, active invitation consent qualifies; the older deadline-reminder opt-in is not treated as permission to invite anyone.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-hairline bg-white p-5">
          <p className="font-mono text-3xl font-semibold text-navy">{summary.reminderOptInCount}</p>
          <h2 className="mt-1 text-sm font-medium text-ink">WhatsApp reminder opt-ins</h2>
          <p className="mt-2 text-xs leading-relaxed text-navy-light">Deadline and match reminders only. This count does not qualify anyone for a community invitation.</p>
        </section>
        <section className="rounded-xl border border-hairline bg-white p-5">
          <p className="font-mono text-3xl font-semibold text-emerald">{summary.eligibleRecipientCount}</p>
          <h2 className="mt-1 text-sm font-medium text-ink">Eligible community invitations</h2>
          <p className="mt-2 text-xs leading-relaxed text-navy-light">
            Distinct, valid Nigerian numbers with active, purpose-specific consent. {summary.activeConsentProfileCount} active consent profile{summary.activeConsentProfileCount === 1 ? "" : "s"} recorded.
          </p>
        </section>
      </div>

      <section className="mb-8 rounded-xl border border-hairline bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-navy">Manual export</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-light">
          The CSV contains only first name and WhatsApp number. It is de-duplicated by normalized number, excludes withdrawn consent and invalid numbers, and is available only to a signed-in founder. No message is sent by downloading it. Export immediately before sending and discard the file after use; a downloaded snapshot cannot reflect later withdrawals.
        </p>
        {summary.eligibleRecipientCount > 0 ? (
          <a
            href="/api/admin/community-invitations/export"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-seal bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-light"
          >
            Download eligible contacts (CSV)
          </a>
        ) : (
          <button type="button" disabled className="mt-4 min-h-[44px] cursor-not-allowed rounded-seal bg-navy px-5 py-2.5 text-sm font-medium text-white opacity-50">
            No eligible contacts to export
          </button>
        )}
      </section>

      <CommunityInvitationMessage />
    </div>
  );
}
