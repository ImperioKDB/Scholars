import { Logo } from "@/components/Logo";

export function AuthShell({
  children,
  heading,
  sub,
}: {
  children: React.ReactNode;
  heading: string;
  sub: string;
}) {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-navy text-white p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 80% 70%, white 0, transparent 40%)",
          }}
        />
        <Logo className="relative" />
        <div className="relative max-w-sm">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-4">
            12,000+ scholarships tracked
          </p>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Your pathway to opportunity starts with one profile.
          </h2>
        </div>
        <p className="relative text-sm text-white/60">
          Built for students in Nigeria applying to local and international
          scholarships alike.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8">
            <Logo className="text-navy" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-navy mb-1">
            {heading}
          </h1>
          <p className="text-sm text-navy-light mb-8">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
