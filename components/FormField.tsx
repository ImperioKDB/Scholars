import { Children, cloneElement, isValidElement, type ReactNode } from "react";

export function FormField({
  label,
  hint,
  error,
  id,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  children: ReactNode;
}) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const child = Children.only(children);
  const field = isValidElement(child)
    ? cloneElement(child, {
        id: child.props.id ?? fieldId,
        "aria-describedby": child.props["aria-describedby"] ?? describedBy,
        "aria-invalid": error ? true : child.props["aria-invalid"],
      } as Record<string, unknown>)
    : child;
  return (
    <div className="block mb-4">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {field}
      {hint && !error && <span id={hintId} className="block text-xs text-navy-light mt-1.5">{hint}</span>}
      {error && (
        // role="alert" makes assistive tech announce the message the
        // moment it renders (product audit: form errors were previously
        // silent for screen reader users). text-xs -> text-sm too: an
        // error is critical information, and 12px is below the size the
        // audit flags as risky on mobile.
        <span id={errorId} role="alert" className="inline-flex items-start rounded-md border border-rose-light bg-rose-light px-2.5 py-1.5 text-sm leading-5 text-rose mt-1.5">
          {error}
        </span>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-navy-light/50 focus:border-navy focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-1 transition-colors";
export const selectClass = inputClass + " appearance-none bg-white";
export const textareaClass = inputClass + " resize-none min-h-[96px]";
