import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Scholars home" className={`flex items-center gap-2 ${className}`}>
      <Image src="/logo.png" alt="" width={26} height={26} priority className="shrink-0" />
      <span className="font-display text-lg font-semibold tracking-tight">
        Scholars
      </span>
    </Link>
  );
}
