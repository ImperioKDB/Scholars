export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-rose mt-1.5">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-navy-light/50 focus:border-navy outline-none transition-colors";
