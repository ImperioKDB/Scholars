"use client";

import { FormField, inputClass, selectClass, textareaClass } from "@/components/FormField";
import { Combobox } from "@/components/Combobox";
import { DISCIPLINE_OPTIONS, type ScholarshipFormValues } from "@/lib/admin/scholarship";

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

      <div className="md:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium text-ink mb-4">
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
