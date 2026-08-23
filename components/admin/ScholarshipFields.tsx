"use client";

import { FormField, inputClass, selectClass, textareaClass } from "@/components/FormField";
import { DISCIPLINE_OPTIONS, type ScholarshipFormValues } from "@/lib/admin/scholarship";

export function ScholarshipFields({
  values,
  errors,
  onChange,
}: {
  values: ScholarshipFormValues;
  errors: Partial<Record<keyof ScholarshipFormValues, string>>;
  onChange: <K extends keyof ScholarshipFormValues>(key: K, value: ScholarshipFormValues[K]) => void;
}) {
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

      <FormField label="Award amount" hint="Free text — amounts vary too much for a fixed format.">
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

      <FormField label="Application URL" error={errors.application_url}>
        <input
          className={inputClass}
          type="url"
          value={values.application_url ?? ""}
          onChange={(e) => onChange("application_url", e.target.value)}
          placeholder="https://..."
        />
      </FormField>

      <FormField label="Academic level">
        <select
          className={selectClass}
          value={values.level}
          onChange={(e) => onChange("level", e.target.value as ScholarshipFormValues["level"])}
        >
          <option value="both">Both undergrad & postgrad</option>
          <option value="undergrad">Undergraduate only</option>
          <option value="postgrad">Postgraduate only</option>
        </select>
      </FormField>

      <FormField label="Field of study" hint="Leave blank if open to any discipline.">
        <select
          className={selectClass}
          value={values.discipline ?? ""}
          onChange={(e) => onChange("discipline", e.target.value)}
        >
          <option value="">Any discipline</option>
          {DISCIPLINE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
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
          Verified — visible to students immediately
        </label>
      </div>
    </div>
  );
}
