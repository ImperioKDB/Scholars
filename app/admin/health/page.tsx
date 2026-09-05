import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/dates";

// app/admin/health/page.tsx
// GET /admin/health
//
// Weekly maintenance triage in one server-rendered page. Pulls the whole
// scholarships table once (small by design) and partitions it into the
// three buckets maintenance actually acts on:
//
//   1. Unverified drafts waiting on review (sub-count: already past
//      deadline, i.e. likely dead listings that should be deleted, not
//      verified).
//   2. Live (verified) listings with no application path -- neither
//      application_url nor how_to_apply -- students can see these but
//      cannot apply. Same rule as the missingApplyPath warning in
//      components/admin/ScholarshipFields.tsx.
//   3. Past-deadline listings. Verified ones are called out separately
//      because they still render to students as "Closed" until someone
//      unverifies or extends them.
//
// Read-only by design: every row links straight to the edit page, so the
// fix happens where the tooling already exists. One query, one render,
// no client JS, no new API route, no migration.

type Row = {
  id: string;
  title: string;
  provider_name: string;
  deadline: string;
  verified: boolean;
  application_url: string | null;
  how_to_apply: string | null;
  updated_at: string;
};

function isPast(deadline: string): boolean {
  const d = daysUntil(deadline);
  return d !== null && d < 0;
}

function DeadlineChip({ deadline }: { deadline: string }) {
  const d = daysUntil(deadline);
  if (d === null) return <span className="text-xs text-navy-light">{deadline}</span>;
  if (d < 0)
    return (
      <span className="text-xs font-mono font-medium px-2 py-1 rounded-full bg-rose-light text-rose">
        Closed {-d}d ago
      </span>
    );
  if (d <= 7)
    return (
      <span className="text-xs font-mono font-medium px-2 py-1 rounded-full bg-amber-light text-amber">
        {d}d left
      </span>
    );
  return <span className="text-xs font-mono text-navy-light">{d}d left</span>;
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={
        "text-xs font-medium px-2 py-1 rounded-full " +
        (verified ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber")
      }
    >
      {verified ? "Live" : "Pending"}
    </span>
  );
}

function Tile({
  value,
  label,
  hint,
  tone,
}: {
  value: number;
  label: string;
  hint: string;
  tone: "amber" | "rose" | "emerald";
}) {
  const toneClass = tone === "amber" ? "text-amber" : tone === "rose" ? "text-rose" : "text-emerald";
  return (
    <div className="bg-white rounded-xl border border-hairline p-5">
      <p className={`font-mono text-3xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-sm text-navy-light mt-1">{label}</p>
      <p className="text-xs text-navy-light mt-0.5">{hint}</p>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-hairline p-5 mb-6">
      <h2 className="font-display text-lg font-semibold text-navy mb-1">{title}</h2>
      <p className="text-sm text-navy-light mb-3">{sub}</p>
      {children}
    </div>
  );
}

function HealthRow({ row, right }: { row: Row; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-hairline last:border-0">
      <div className="min-w-0">
        <Link
          href={`/admin/scholarships/${row.id}/edit`}
          className="text-sm font-medium text-ink hover:text-navy block truncate"
        >
          {row.title}
        </Link>
        <p className="text-xs text-navy-light">{row.provider_name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

function AllClear() {
  return <p className="text-sm text-emerald">Nothing here -- all clear.</p>;
}

export default async function AdminHealthPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scholarships")
    .select("id, title, provider_name, deadline, verified, application_url, how_to_apply, updated_at")
    .order("deadline", { ascending: true });

  if (error) {
    return <p className="text-sm text-rose">Couldn&apos;t load health data: {error.message}</p>;
  }

  const rows = (data ?? []) as Row[];
  const unverified = rows.filter((r) => !r.verified);
  const unverifiedPast = unverified.filter((r) => isPast(r.deadline));
  const missingPath = rows.filter(
    (r) => r.verified && !r.application_url?.trim() && !r.how_to_apply?.trim()
  );
  const stale = rows.filter((r) => isPast(r.deadline));
  const staleLive = stale.filter((r) => r.verified);
  const attention = unverified.length + missingPath.length + staleLive.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Health check</h1>
          <p className="text-sm text-navy-light mt-1">
            {attention === 0
              ? "All clear -- nothing needs attention this week."
              : `${attention} item${attention === 1 ? "" : "s"} need attention this week.`}
          </p>
        </div>
        <Link href="/admin/scholarships" className="text-sm text-navy hover:underline">
          Open scholarships table
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Tile
          value={unverified.length}
          label="Unverified drafts"
          hint={`${unverifiedPast.length} already past deadline`}
          tone={unverified.length > 0 ? "amber" : "emerald"}
        />
        <Tile
          value={missingPath.length}
          label="Live with no apply path"
          hint="verified, but no URL or how-to-apply"
          tone={missingPath.length > 0 ? "rose" : "emerald"}
        />
        <Tile
          value={stale.length}
          label="Past-deadline listings"
          hint={`${staleLive.length} still live to students`}
          tone={staleLive.length > 0 ? "rose" : stale.length > 0 ? "amber" : "emerald"}
        />
      </div>

      <Section
        title="Unverified drafts"
        sub="Waiting on review. Past-deadline ones are usually dead listings: delete rather than verify."
      >
        {unverified.length === 0 ? (
          <AllClear />
        ) : (
          unverified.map((r) => (
            <HealthRow key={r.id} row={r} right={<DeadlineChip deadline={r.deadline} />} />
          ))
        )}
      </Section>

      <Section
        title="Live with no application path"
        sub="Students can see these but cannot apply. Add an application URL or how-to-apply text, or unverify."
      >
        {missingPath.length === 0 ? (
          <AllClear />
        ) : (
          missingPath.map((r) => (
            <HealthRow
              key={r.id}
              row={r}
              right={
                <>
                  <DeadlineChip deadline={r.deadline} />
                  <VerifiedBadge verified={r.verified} />
                </>
              }
            />
          ))
        )}
      </Section>

      <Section
        title="Past deadline"
        sub="Verified rows still show to students as Closed until unverified or extended. Unverified rows should usually be deleted."
      >
        {stale.length === 0 ? (
          <AllClear />
        ) : (
          stale.map((r) => (
            <HealthRow
              key={r.id}
              row={r}
              right={
                <>
                  <DeadlineChip deadline={r.deadline} />
                  <VerifiedBadge verified={r.verified} />
                </>
              }
            />
          ))
        )}
      </Section>
    </div>
  );
}
