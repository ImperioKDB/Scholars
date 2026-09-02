\"use client\";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScholarshipFields } from "@/components/admin/ScholarshipFields";
import { RuleBuilder } from "@/components/admin/RuleBuilder";
import {
  EMPTY_SCHOLARSHIP,
  emptyRule,
  scholarshipSchema,
  serializeRuleValue,
  type RuleFormRow,
  type ScholarshipFormValues,
} from "@/lib/admin/scholarship";

export default function NewScholarshipPage() {
  const router = useRouter();

  const [values, setValues] = useState<ScholarshipFormValues>(EMPTY_SCHOLARSHIP);
  const [rules, setRules] = useState<RuleFormRow[]>([emptyRule()]);
  const [errors, setErrors] = useState<Partial<Record<keyof ScholarshipFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

    const validRules = rules.filter((r) => r.field && (r.operator === "exists" || r.value !== ""));

    setSaving(true);

    const res = await fetch("/api/admin/scholarships", {
      method: "POST",
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
        // Competitiveness fields arrive from the form as raw strings (see
        // lib/admin/scholarship.ts) -- convert to the numeric/null shape
        // the API expects, same pattern application_url/etc. already use.
        awards_available: parsed.data.awards_available ? Number(parsed.data.awards_available) : null,
        estimated_applicant_pool: parsed.data.estimated_applicant_pool
          ? Number(parsed.data.estimated_applicant_pool)
          : null,
        competitiveness_tier: parsed.data.competitiveness_tier || null,
        historical_acceptance_rate: parsed.data.historical_acceptance_rate
          ? Number(parsed.data.historical_acceptance_rate)
          : null,
        competitiveness_notes: parsed.data.competitiveness_notes || null,
        rules: validRules.map((r) => ({
          field: r.field,
          operator: r.operator,
          value: serializeRuleValue(r.field, r.operator, r.value),
        })),
      }),
    });

    setSaving(false);

    if (res.status === 403) {
      setSubmitError("Admin access required. Ask an existing admin to set is_admin on your profile.");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? "Couldn't save the scholarship.");
      return;
    }

    router.push("/admin/scholarships");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-navy mb-1">Add a scholarship</h1>
      <p className="text-sm text-navy-light mb-8">Fill in the details, then add the rules that determine eligibility.</p>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-hairline p-6 mb-6">
          <ScholarshipFields values={values} errors={errors} onChange={update} />
        </div>

        <div className="bg-white rounded-xl border border-hairline p-6 mb-6">
          <h2 className="font-display text-lg font-semibold text-navy mb-1">Eligibility rules</h2>
          <p className="text-sm text-navy-light mb-4">
            These drive the match score students see. Rules on fields your students fill in during
            onboarding (GPA, nationality, discipline, etc.) are checked automatically.
          </p>
          <RuleBuilder rules={rules} onChange={setRules} />
        </div>

        {submitError && <p className="text-sm text-rose mb-4">{submitError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save scholarship"}
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
