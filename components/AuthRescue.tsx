"use client";
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

// components/AuthRescue.tsx
//
// Self-healing safety net for auth redirects. When Supabase rejects a
// redirectTo (allowlist drift, domain changes), it falls back to the Site
// URL root and strands the auth code / recovery token on the marketing
// page. That used to paint the whole landing page for a beat before
// routing on, which testers read as "it sent me to the homepage".
//
// FLASH FIX: the token check now runs in useLayoutEffect and raises a
// full-screen parchment splash BEFORE the browser paints, so the
// marketing page is never visible during a rescue. The splash stays up
// until the session event routes us, or a 4s timeout gives up and cleans
// the dead tokens out of the address bar.
//
// Mounted in the root layout, this watches the ROOT PATH ONLY.
//   PASSWORD_RECOVERY -> /reset-password/update (handoff via sessionStorage)
//   SIGNED_IN         -> /dashboard
export const RECOVERY_REDIRECT_FLAG = "scholars.recovery_redirect";

export function AuthRescue() {
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);
  const [rescuing, setRescuing] = useState(false);

  // useLayoutEffect + setState here re-renders synchronously before
  // paint, so the splash covers the landing on the very first frame.
  useLayoutEffect(() => {
    if (pathname !== "/" || handled.current) return;
    const url = new URL(window.location.href);
    const hasTokens = url.searchParams.has("code") || url.hash.includes("access_token=");
    if (!hasTokens) return;
    handled.current = true;
    setRescuing(true);
  }, [pathname]);

  useEffect(() => {
    if (!rescuing) return;
    const supabase = createClient();
    let routed = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (routed) return;
      if (event === "PASSWORD_RECOVERY") {
        routed = true;
        try {
          sessionStorage.setItem(RECOVERY_REDIRECT_FLAG, "1");
        } catch {
          // storage blocked -- the update page also listens for the event
        }
        router.replace("/reset-password/update");
      } else if (event === "SIGNED_IN") {
        routed = true;
        router.replace("/dashboard");
      }
    });
    // Exchange failed or never fired (expired code, revoked session):
    // drop the splash and strip the dead tokens so the landing renders
    // cleanly.
    const t = setTimeout(() => {
      if (!routed) {
        setRescuing(false);
        window.history.replaceState(null, "", "/");
      }
    }, 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [rescuing, router]);

  if (!rescuing) return null;
  return (
    <div
      className="fixed inset-0 z-[99] bg-parchment flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <Logo className="text-navy" />
      <p className="text-sm text-navy-light">Signing you in&hellip;</p>
      <svg className="animate-spin h-5 w-5 text-navy-light" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}
