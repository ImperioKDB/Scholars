\"use client\";

import { FormField, inputClass, selectClass, textareaClass } from "@/components/FormField";
import { Combobox } from "@/components/Combobox";
import {
  COMPETITIVENESS_TIER_OPTIONS,
  DISCIPLINE_OPTIONS,
  type ScholarshipFormValues,
} from "@/lib/admin/scholarship";

const DISCIPLINE_COMBO_OPTIONS = DISCIPLINE_OPTIONS.map((d) => ({ value: d, label: d }));

export function ScholarshipFields({
  values,
  errors,
  onChange,
}: {
  values: ScholarshipFormValues;
  errors: Partial<Record<keyof ScholarshipFormValues, string>>;
  onChange: <K extends keyof ScholarshipFormValues>(key: K, value: ScholarshipFormValues[K]) => void;
}) {
  const missingApplyPath = values.verified && !values.application_url?.trim() && !values.how_to_apply?.trim();

  return (
    <div className="grid md:grid-cols-2 gap-x-6">
      <div className="md:col-span-2">
        <FormField label="Title" error={errors.title}>
          <input
            className={inputClass}
            value={values.title}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="e.g. MTN Foundation Science & Technology Scholarship"
          />
        </FormField>
      </div>

      <FormField label="Provider name" error={errors.provider_name}>
        <input
          className={inputClass}
          value={values.provider_name}
          onChange={(e) => onChange("provider_name", e.target.value)}
          placeholder="e.g. MTN Foundation"
        />
      </FormField>

      <FormField label="Award amount" hint="Free text -- amounts vary too much for a fixed format.">
        <input
          className={inputClass}
          value={values.amount ?? ""}
          onChange={(e) => onChange("amount", e.target.value)}
          placeholder="e.g. ₦300,000 + Mentorship"
        />
      </FormField>

      <FormField label="Deadline" error={errors.deadline}>
        <input
          className={inputClass}
          type="date"
          value={values.deadline}
          onChange={(e) => onChange("deadline", e.target.value)}
        />
      </FormField>

      <FormField
        label="Application URL"
        error={errors.application_url}
        hint="Leave blank only if there's genuinely no direct online link -- fill in 'How to apply' below instead so students still have a path."
      >
        <input
          className={inputClass}
          type="url"
          value={values.application_url ?? ""}
          onChange={(e) => onChange("application_url", e.target.value)}
          placeholder="https://..."
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField
          label="How to apply (fallback)"
          error={errors.how_to_apply}
          hint="Shown to students instead of an Apply button when there's no Application URL -- e.g. an application email, or which admissions office to contact. Leave blank if the URL above covers it."
        >
          <textarea
            className={textareaClass}
            value={values.how_to_apply ?? ""}
            onChange={(e) => onChange("how_to_apply", e.target.value)}
            placeholder="e.g. Applications are handled by email -- send a CGPA transcript and a 300-500 word essay to admissions@example.org."
          />
        </FormField>
      </div>

      {missingApplyPath && (
        <div className="md:col-span-2 -mt-2 mb-4">
          <p className="text-xs text-amber bg-amber-light rounded-lg px-3.5 py-2.5">
            This scholarship is marked Verified but has neither an Application URL nor How-to-apply
            text. Students won&apos;t see any way to apply. Fill in at least one before publishing.
          </p>
        </div>
      )}

      <FormField label="Academic level" hint="Platform is undergrad-only -- postgrad listings won't be matched or shown.">
        <select
          className={selectClass}
          value={values.level}
          onChange={(e) => onChange("level", e.target.value as ScholarshipFormValues["level"])}
        >
          <option value="both">Both / not level-specific</option>
          <option value="undergrad">Undergraduate only</option>
        </select>
      </FormField>

      <FormField label="Field of study" hint="Leave blank if open to any discipline. Search and select -- typing alone won't set it.">
        <Combobox
          options={DISCIPLINE_COMBO_OPTIONS}
          value={values.discipline ?? ""}
          onChange={(value) => onChange("discipline", value)}
          placeholder="Search a course, or leave blank for any"
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Description">
          <textarea
            className={textareaClass}
            value={values.description ?? ""}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="A short summary of what this scholarship covers and who it's for."
          />
        </FormField>
      </div>

      {/* Competitiveness -- separate from eligibility rules above. These
          feed lib/matching/engine.ts's computeCompetitivenessFactor, which
          discounts (never boosts) the eligibility score students see based
          on how oversubscribed the award actually is. All optional --
          leaving this blank simply means the score isn't discounted, not
          that the scholarship is penalized for missing research. */}
      <div className="md:col-span-2 border-t border-hairline pt-5 mt-1">
        <h3 className="text-sm font-semibold text-ink mb-1">Competitiveness (optional)</h3>
        <p className="text-xs text-navy-light mb-4">
          Adjusts the match score students see -- an eligible student for a 5-spot, 10,000-applicant
          award should see a more cautious score than one for a 200-spot award. Leave blank if you
          haven&apos;t researched this yet; unresearched scholarships are not penalized.
        </p>
      </div>

      <FormField
        label="Awards available"
        error={errors.awards_available}
        hint="Slots per cycle, if known."
      >
        <input
          className={inputClass}
          type="number"
          min="1"
          value={values.awards_available ?? ""}
          onChange={(e) => onChange("awards_available", e.target.value)}
          placeholder="e.g. 50"
        />
      </FormField>

      <FormField
        label="Estimated applicant pool"
        error={errors.estimated_applicant_pool}
        hint="Your best researched estimate."
      >
        <input
          className={inputClass}
          type="number"
          min="1"
          value={values.estimated_applicant_pool ?? ""}
          onChange={(e) => onChange("estimated_applicant_pool", e.target.value)}
          placeholder="e.g. 3000"
        />
      </FormField>

      <FormField
        label="Competitiveness tier"
        hint="Fallback used when you don't have precise awards/pool numbers."
      >
        <select
          className={selectClass}
          value={values.competitiveness_tier ?? ""}
          onChange={(e) => onChange("competitiveness_tier", e.target.value as ScholarshipFormValues["competitiveness_tier"])}
        >
          <option value="">Not set</option>
          {COMPETITIVENESS_TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Historical acceptance rate"
        error={errors.historical_acceptance_rate}
        hint="0 to 1, e.g. 0.08 for 8%. From past cycles, if known."
      >
        <input
          className={inputClass}
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={values.historical_acceptance_rate ?? ""}
          onChange={(e) => onChange("historical_acceptance_rate", e.target.value)}
          placeholder="e.g. 0.08"
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField
          label="Competitiveness notes (admin-only)"
          hint="Sourcing/reasoning -- never shown to students, same as research notes."
        >
          <textarea
            className={textareaClass}
            value={values.competitiveness_notes ?? ""}
            onChange={(e) => onChange("competitiveness_notes", e.target.value)}
            placeholder="e.g. Provider's 2025 annual report cites ~1,200 applicants for 40 slots."
          />
        </FormField>
      </div>

      <div className="md:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium text-ink mb-4 mt-2">
          <input
            type="checkbox"
            checked={values.verified}
            onChange={(e) => onChange("verified", e.target.checked)}
            className="rounded border-hairline"
          />
          Verified -- visible to students immediately
        </label>
      </div>
    </div>
  );
}
