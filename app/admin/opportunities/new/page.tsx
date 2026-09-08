"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OpportunityFields } from "@/components/admin/OpportunityFields";
import { EMPTY_OPPORTUNITY, opportunitySchema, type OpportunityFormValues } from "@/lib/admin/opportunity";

export default function NewOpportunityPage() {
  const router = useRouter();

  const [values, setValues] = useState<OpportunityFormValues>(EMPTY_OPPORTUNITY);
  const [errors, setErrors] = useState<Partial<Record<keyof OpportunityFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof OpportunityFormValues>(key: K, value: OpportunityFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const parsed = opportunitySchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof OpportunityFormValues] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const res = await fetch("/api/admin/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: parsed.data.type,
        title: parsed.data.title,
        provider_name: parsed.data.provider_name,
        description: parsed.data.description || null,
        eligibility_notes: parsed.data.eligibility_notes || null,
        duration: parsed.data.duration || null,
        location: parsed.data.location || null,
        compensation: parsed.data.compensation || null,
        discipline: parsed.data.discipline || null,
        deadline: parsed.data.deadline || null,
        opens_at: parsed.data.opens_at || null,
        application_url: parsed.data.application_url || null,
        how_to_apply: parsed.data.how_to_apply || null,
        verified: parsed.data.verified,
        research_notes: parsed.data.research_notes || null,
      }),
    });

    setSaving(false);

    if (res.status === 403) {
      setSubmitError("Admin access required. Ask an existing admin to set is_admin on your profile.");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? "Couldn't save the opportunity.");
      return;
    }

    router.push("/admin/opportunities");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-navy mb-1">Add an opportunity</h1>
      <p className="text-sm text-navy-light mb-8">
        Fellowships, internships, competitions, and mentorships -- not scored, so no eligibility rules to
        configure.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-hairline p-6 mb-6">
          <OpportunityFields values={values} errors={errors} onChange={update} />
        </div>

        {submitError && <p className="text-sm text-rose mb-4">{submitError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {saving ? "Saving\u2026" : "Save opportunity"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/opportunities")}
            className="text-sm font-medium text-navy-light hover:text-navy"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
