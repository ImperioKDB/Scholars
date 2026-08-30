import Link from "next/link";

// Shared back-navigation control for drill-down / detail views. Styled as
// a real button (border, fill, 44px+ tap target, press feedback) rather
// than a bare text link -- a thin text baseline is a poor touch target
// and doesn't read as interactive on a phone screen. active:scale matches
// the global button press convention in app/globals.css so this feels
// consistent with every other pressable element in the app, even though
// it's a <Link> rather than a <button>.
export function BackLink({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-seal border border-hairline bg-white px-4 py-2.5 text-sm font-medium text-navy hover:bg-navy-50 hover:border-navy/20 active:scale-[0.98] transition-all mb-6"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
