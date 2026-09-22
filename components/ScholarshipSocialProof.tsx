import type { ScholarshipSocialProof } from "@/lib/scholarship-community";

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ScholarshipSocialProof({ proof }: { proof: ScholarshipSocialProof }) {
  const signals = [
    proof.saved_count > 0 ? countLabel(proof.saved_count, "student saved this", "students saved this") : null,
    proof.applied_count > 0 ? countLabel(proof.applied_count, "student started an application", "students started applications") : null,
    proof.discussion_student_count > 0 ? countLabel(proof.discussion_student_count, "student discussing this", "students discussing this") : null,
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-xl border border-hairline bg-parchment/60 p-4" aria-labelledby="social-proof-title">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-light text-emerald" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" strokeLinecap="round" />
            <circle cx="10" cy="7" r="3" />
            <path d="M17 11a3 3 0 1 0-1.5-5.6M16 15h2a3.5 3.5 0 0 1 3.5 3.5V20" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="social-proof-title" className="text-sm font-semibold text-navy">Student activity</h2>
          {signals.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {signals.map((signal) => (
                <span key={signal} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-navy-light shadow-sm">
                  {signal}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-navy-light">
              Be the first student to save this award or start a conversation.
            </p>
          )}
          {proof.recent_view_count >= 5 && (
            <p className="mt-2 text-xs text-navy-light">
              Viewed by {proof.recent_view_count} students in the last 30 days.
            </p>
          )}
          {proof.recent_institutions.length > 0 && (
            <p className="mt-1 text-xs text-navy-light">
              Popular with students from {proof.recent_institutions.map((item) => item.name).join(", ")}.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-navy-light/80">
            Counts are aggregated from student activity. Institution insights only appear after at least five students.
          </p>
        </div>
      </div>
    </section>
  );
}
