\"use client\";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ScholarshipFields } from "@/components/admin/ScholarshipFields";
import { RuleBuilder } from "@/components/admin/RuleBuilder";
import {
  EMPTY_SCHOLARSHIP,
  diffRules,
  parseRuleValue,
  scholarshipSchema,
  serializeRuleValue,
  type RuleFormRow,
  type RuleOperator,
  type ScholarshipFormValues,
} from "@/lib/admin/scholarship";

// The admin list API returns competitiveness fields in their real DB
// shape (nullable number/enum), not the form's raw-string shape (see
// lib/admin/scholarship.ts) -- Omit + re-declare those five keys here
// rather than intersecting ScholarshipFormValues directly, since the form
// and DB shapes for these fields genuinely differ (string vs number/enum).
type AdminScholarship = Omit<
  ScholarshipFormValues,
  | "awards_available"
  | "estimated_applicant_pool"
  | "competitiveness_tier"
  | "historical_acceptance_rate"
  | "competitiveness_notes"
> & {
  id: string;
  awards_available: number | null;
  estimated_applicant_pool: number | null;
  competitiveness_tier: "low" | "medium" | "high" | "very_high" | null;
  historical_acceptance_rate: number | null;
  competitiveness_notes: string | null;
  scholarship_rules: { id: string; field: string; operator: RuleOperator; value: unknown }[];
};

export default function EditScholarshipPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [values, setValues] = useState<ScholarshipFormValues>(EMPTY_SCHOLARSHIP);
  const [rules, setRules] = useState<RuleFormRow[]>([]);
  const [originalRules, setOriginalRules] = useState<RuleFormRow[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof ScholarshipFormValues, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      // No single-scholarship GET route exists — the admin list already
      // returns everything (verified + unverified) with rules embedded,
      // and at MVP scale that's cheaper than adding a new backend route
      // for one lookup.
      const res = await fetch("/api/admin/scholarships");
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { scholarships } = await res.json();
      const scholarship = (scholarships as AdminScholarship[]).find((s) => s.id === params.id);

      if (!scholarship) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setValues({
        title: scholarship.title,
        provider_name: scholarship.provider_name,
        description: scholarship.description ?? "",
        amount: scholarship.amount ?? "",
        deadline: scholarship.deadline,
        application_url: scholarship.application_url ?? "",
        how_to_apply: scholarship.how_to_apply ?? "",
        level: scholarship.level,
        discipline: scholarship.discipline ?? "",
        verified: scholarship.verified,
        // DB numeric/enum values -> form's raw-string representation, the
        // inverse of the conversion done on submit below.
        awards_available: scholarship.awards_available != null ? String(scholarship.awards_available) : "",
        estimated_applicant_pool:
          scholarship.estimated_applicant_pool != null ? String(scholarship.estimated_applicant_pool) : "",
        competitiveness_tier: scholarship.competitiveness_tier ?? "",
        historical_acceptance_rate:
          scholarship.historical_acceptance_rate != null ? String(scholarship.historical_acceptance_rate) : "",
        competitiveness_notes: scholarship.competitiveness_notes ?? "",
      });

      const loadedRules: RuleFormRow[] = (scholarship.scholarship_rules ?? []).map((r) => ({
        key: crypto.randomUUID(),
        id: r.id,
        field: r.field,
        operator: r.operator,
        value: parseRuleValue(r.field, r.operator, r.value),
      }));
      setRules(loadedRules);
      setOriginalRules(loadedRules);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function update<K extends keyof ScholarshipFormValues>(key: K, value: ScholarshipFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const parsed = scholarshipSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof ScholarshipFormValues] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setSaving(true);

    const updateRes = await fetch(`/api/admin/scholarships/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: parsed.data.title,
        provider_name: parsed.data.provider_name,
        description: parsed.data.description || null,
        amount: parsed.data.amount || null,
        deadline: parsed.data.deadline,
        application_url: parsed.data.application_url || null,
        how_to_apply: parsed.data.how_to_apply || null,
        level: parsed.data.level,
        discipline: parsed.data.discipline || null,
        verified: parsed.data.verified,
        awards_available: parsed.data.awards_available ? Number(parsed.data.awards_available) : null,
        estimated_applicant_pool: parsed.data.estimated_applicant_pool
          ? Number(parsed.data.estimated_applicant_pool)
          : null,
        competitiveness_tier: parsed.data.competitiveness_tier || null,
        historical_acceptance_rate: parsed.data.historical_acceptance_rate
          ? Number(parsed.data.historical_acceptance_rate)
          : null,
        competitiveness_notes: parsed.data.competitiveness_notes || null,
      }),
    });

    if (!updateRes.ok) {
      setSaving(false);
      const body = await updateRes.json().catch(() => ({}));
      setSubmitError(body.error ?? "Couldn't save changes.");
      return;
    }

    // The rules API only exposes add-one / delete-one, not bulk replace —
    // diff against what was originally loaded and reconcile with the
    // minimum number of calls, rather than wiping and rebuilding.
    const validRules = rules.filter((r) => r.field && (r.operator === "exists" || r.value !== ""));
    const { toDelete, toAdd } = diffRules(originalRules, validRules);

    const deleteResults = await Promise.all(
      toDelete.map((ruleId) =>
        fetch(`/api/admin/scholarships/${params.id}/rules/${ruleId}`, { method: "DELETE" })
      )
    );
    const addResults = await Promise.all(
      toAdd.map((r) =>
        fetch(`/api/admin/scholarships/${params.id}/rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: r.field,
            operator: r.operator,
            value: serializeRuleValue(r.field, r.operator, r.value),
          }),
        })
      )
    );

    setSaving(false);

    const ruleFailure = [...deleteResults, ...addResults].some((r) => !r.ok);
    if (ruleFailure) {
      setSubmitError("Scholarship saved, but one or more rule changes failed. Reload and check the rules below.");
      return;
    }

    router.push("/admin/scholarships");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${values.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/scholarships/${params.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/scholarships");
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
    return <p className="text-sm text-rose">Scholarship not found, or admin access is required.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold text-navy">Edit scholarship</h1>
        <button onClick={handleDelete} className="text-sm font-medium text-rose hover:underline">
          Delete scholarship
        </button>
      </div>
      <p className="text-sm text-navy-light mb-8">{values.title}</p>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-hairline p-6 mb-6">
          <ScholarshipFields values={values} errors={errors} onChange={update} />
        </div>

        <div className="bg-white rounded-xl border border-hairline p-6 mb-6">
          <h2 className="font-display text-lg font-semibold text-navy mb-1">Eligibility rules</h2>
          <p className="text-sm text-navy-light mb-4">These drive the match score students see.</p>
          <RuleBuilder rules={rules} onChange={setRules} />
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
            onClick={() => router.push("/admin/scholarships")}
            className="text-sm font-medium text-navy-light hover:text-navy"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
