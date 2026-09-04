import Link from "next/link";
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
          {/* Was a fabricated "12,000+ scholarships tracked" stat -- the
              live seed data is nowhere near that number, and claiming it
              here is exactly the kind of thing that breaks trust the
              moment a new signup sees 5 real matches. Replaced with a
              true, still-differentiating claim instead of a fake count. */}
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-4">
            Matched to real eligibility, not keywords
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
          {/* AUDIT FIX (batch 3): the audit flagged that no privacy policy
              or terms were visible anywhere in the product. Auth is where
              that consent conversation belongs -- this one line covers
              login, signup, and both reset-password screens, since they
              all render through this shell. */}
          <p className="text-xs text-navy-light mt-8 leading-relaxed">
            By continuing, you agree to our{" "}
            <Link href="/legal/terms" className="text-navy font-medium hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-navy font-medium hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
