"use client";

import { FormField, inputClass, selectClass, textareaClass } from "@/components/FormField";
import { Combobox } from "@/components/Combobox";
import { DISCIPLINE_OPTIONS, OPPORTUNITY_TYPE_OPTIONS, type OpportunityFormValues } from "@/lib/admin/opportunity";

const DISCIPLINE_COMBO_OPTIONS = DISCIPLINE_OPTIONS.map((d) => ({ value: d, label: d }));

export function OpportunityFields({
  values,
  errors,
  onChange,
}: {
  values: OpportunityFormValues;
  errors: Partial<Record<keyof OpportunityFormValues, string>>;
  onChange: <K extends keyof OpportunityFormValues>(key: K, value: OpportunityFormValues[K]) => void;
}) {
  const missingApplyPath = values.verified && !values.application_url?.trim() && !values.how_to_apply?.trim();

  return (
    <div className="grid md:grid-cols-2 gap-x-6">
      <FormField label="Type" error={errors.type}>
        <select
          className={selectClass}
          value={values.type}
          onChange={(e) => onChange("type", e.target.value as OpportunityFormValues["type"])}
        >
          {OPPORTUNITY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Provider / organization" error={errors.provider_name}>
        <input
          className={inputClass}
          value={values.provider_name}
          onChange={(e) => onChange("provider_name", e.target.value)}
          placeholder="e.g. Flutterwave"
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Title" error={errors.title}>
          <input
            className={inputClass}
            value={values.title}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="e.g. Software Engineering Internship"
          />
        </FormField>
      </div>

      <FormField label="Deadline" hint="Leave blank if rolling / no fixed deadline.">
        <input
          className={inputClass}
          type="date"
          value={values.deadline ?? ""}
          onChange={(e) => onChange("deadline", e.target.value)}
        />
      </FormField>

      <FormField label="Opens on" error={errors.opens_at} hint="Leave blank if already open.">
        <input
          className={inputClass}
          type="date"
          value={values.opens_at ?? ""}
          onChange={(e) => onChange("opens_at", e.target.value)}
        />
      </FormField>

      <FormField label="Duration" hint="e.g. '6 weeks', 'Sept-Dec 2026', 'Ongoing'.">
        <input
          className={inputClass}
          value={values.duration ?? ""}
          onChange={(e) => onChange("duration", e.target.value)}
          placeholder="e.g. 3 months"
        />
      </FormField>

      <FormField label="Location">
        <input
          className={inputClass}
          value={values.location ?? ""}
          onChange={(e) => onChange("location", e.target.value)}
          placeholder="e.g. Remote, or Lagos, onsite"
        />
      </FormField>

      <FormField label="Compensation" hint="Stipend, pay, or leave blank if unpaid/unknown.">
        <input
          className={inputClass}
          value={values.compensation ?? ""}
          onChange={(e) => onChange("compensation", e.target.value)}
          placeholder="e.g. NGN 80,000/month stipend"
        />
      </FormField>

      <FormField label="Field of study" hint="Leave blank if open to any discipline.">
        <Combobox
          options={DISCIPLINE_COMBO_OPTIONS}
          value={values.discipline ?? ""}
          onChange={(value) => onChange("discipline", value)}
          placeholder="Search a course, or leave blank for any"
        />
      </FormField>

      <FormField
        label="Application URL"
        error={errors.application_url}
        hint="Leave blank only if there's genuinely no direct online link -- fill in 'How to apply' below instead."
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
          hint="Shown instead of an Apply button when there's no Application URL."
        >
          <textarea
            className={textareaClass}
            value={values.how_to_apply ?? ""}
            onChange={(e) => onChange("how_to_apply", e.target.value)}
            placeholder="e.g. Send a CV and short cover note to careers@example.org."
          />
        </FormField>
      </div>

      {missingApplyPath && (
        <div className="md:col-span-2 -mt-2 mb-4">
          <p className="text-xs text-amber bg-amber-light rounded-lg px-3.5 py-2.5">
            This is marked Verified but has neither an Application URL nor How-to-apply text. Students
            won&apos;t see any way to apply.
          </p>
        </div>
      )}

      <div className="md:col-span-2">
        <FormField label="Description">
          <textarea
            className={textareaClass}
            value={values.description ?? ""}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="A short summary of what this opportunity involves and who it's for."
          />
        </FormField>
      </div>

      <div className="md:col-span-2">
        <FormField
          label="Eligibility notes"
          error={errors.eligibility_notes}
          hint="Free text, shown as-is to students. Not scored or gated -- unlike scholarship rules, this is informational only."
        >
          <textarea
            className={textareaClass}
            value={values.eligibility_notes ?? ""}
            onChange={(e) => onChange("eligibility_notes", e.target.value)}
            placeholder="e.g. Open to 200-level+ students in any STEM discipline. Remote applicants welcome."
          />
        </FormField>
      </div>

      <div className="md:col-span-2">
        <FormField
          label="Research notes (admin-only)"
          error={errors.research_notes}
          hint="Sourcing/verification notes -- never shown to students."
        >
          <textarea
            className={textareaClass}
            value={values.research_notes ?? ""}
            onChange={(e) => onChange("research_notes", e.target.value)}
            placeholder="e.g. Confirmed via provider's official careers page, checked 2026-09-06."
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
