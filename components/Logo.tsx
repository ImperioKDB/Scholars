import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image src="/logo.png" alt="" width={26} height={26} priority className="shrink-0" />
      <span className="font-display text-lg font-semibold tracking-tight">
        ScholarSync
      </span>
    </div>
  );
}
