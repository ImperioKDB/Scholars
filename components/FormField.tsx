export function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-navy-light mt-1.5">{hint}</span>}
      {error && (
        // role="alert" makes assistive tech announce the message the
        // moment it renders (product audit: form errors were previously
        // silent for screen reader users). text-xs -> text-sm too: an
        // error is critical information, and 12px is below the size the
        // audit flags as risky on mobile.
        <span role="alert" className="block text-sm text-rose mt-1.5">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-navy-light/50 focus:border-navy outline-none transition-colors";
export const selectClass = inputClass + " appearance-none bg-white";
export const textareaClass = inputClass + " resize-none min-h-[96px]";
