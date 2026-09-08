"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OpportunityFields } from "@/components/admin/OpportunityFields";
import { EMPTY_OPPORTUNITY, opportunitySchema, type OpportunityFormValues } from "@/lib/admin/opportunity";

type AdminOpportunity = OpportunityFormValues & {
  id: string;
};

export default function EditOpportunityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [values, setValues] = useState<OpportunityFormValues>(EMPTY_OPPORTUNITY);
  const [errors, setErrors] = useState<Partial<Record<keyof OpportunityFormValues, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      // No single-opportunity GET route exists -- the admin list already
      // returns everything (verified + unverified), same pattern as the
      // scholarship edit page.
      const res = await fetch("/api/admin/opportunities");
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { opportunities } = await res.json();
      const opportunity = (opportunities as AdminOpportunity[]).find((o) => o.id === params.id);

      if (!opportunity) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setValues({
        type: opportunity.type,
        title: opportunity.title,
        provider_name: opportunity.provider_name,
        description: opportunity.description ?? "",
        eligibility_notes: opportunity.eligibility_notes ?? "",
        duration: opportunity.duration ?? "",
        location: opportunity.location ?? "",
        compensation: opportunity.compensation ?? "",
        discipline: opportunity.discipline ?? "",
        deadline: opportunity.deadline ?? "",
        opens_at: opportunity.opens_at ?? "",
        application_url: opportunity.application_url ?? "",
        how_to_apply: opportunity.how_to_apply ?? "",
        verified: opportunity.verified,
        research_notes: opportunity.research_notes ?? "",
      });
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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

    const res = await fetch(`/api/admin/opportunities/${params.id}`, {
      method: "PATCH",
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

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? "Couldn't save changes.");
      return;
    }

    router.push("/admin/opportunities");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${values.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/opportunities/${params.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/opportunities");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? "Couldn't delete.");
    }
  }

  if (loading) {
    return <p className="text-sm text-navy-light">Loading…</p>;
  }

  if (notFound) {
    return <p className="text-sm text-rose">Opportunity not found, or admin access is required.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold text-navy">Edit opportunity</h1>
        <button onClick={handleDelete} className="text-sm font-medium text-rose hover:underline">
          Delete opportunity
        </button>
      </div>
      <p className="text-sm text-navy-light mb-8">{values.title}</p>

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
            {saving ? "Saving…" : "Save changes"}
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
