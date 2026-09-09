import Link from "next/link";
import { Logo } from "@/components/Logo";

// components/AuthShell.tsx
// COLOR FIX (test feedback): the left panel used to carry a white 6%
// radial wash over bg-navy, which lightened it visibly away from the
// app's navy (#0B1E3D) everywhere else (buttons, seals, sidebar text).
// The wash is gone. The panel base is now exactly the navy token, with a
// same-family vignette (darker navy at the corners, a faint navy-light
// glow top-left) for depth without shifting the hue or the value.
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
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 82% 88%, rgba(6,15,31,0.55) 0%, transparent 55%), radial-gradient(circle at 15% 10%, rgba(20,49,92,0.35) 0%, transparent 45%)",
          }}
        />
        <Logo className="relative" />
        <div className="relative max-w-sm">
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
