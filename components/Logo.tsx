import Link from "next/link";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      focusable="false"
    >
      <use href="/logo.svg#mark" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Scholars home" className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="h-[26px] w-[26px] shrink-0" />
      <span className="font-display text-lg font-semibold tracking-tight">
        Scholars
      </span>
    </Link>
  );
}
