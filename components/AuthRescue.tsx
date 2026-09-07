"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// components/AuthRescue.tsx
//
// Self-healing safety net for auth redirects. When Supabase rejects a
// redirectTo (allowlist drift, domain changes, config copied between
// projects), it falls back to the Site URL root and strands the auth
// code / recovery token on the marketing page, which previously died
// silently -- the "redirects to homepage after picking my account" bug.
//
// Mounted in the root layout, this component watches the ROOT PATH ONLY.
// If auth tokens are present in the URL there, it creates the browser
// client (supabase-js then exchanges ?code= / fragment tokens
// automatically via detectSessionInUrl) and routes the resulting session
// to where the flow originally intended:
//   PASSWORD_RECOVERY -> /reset-password/update (handoff via sessionStorage)
//   SIGNED_IN         -> /dashboard
//
// It no-ops on every other path and on the root without tokens, so normal
// browsing, the landing page, and the real /auth/callback route (which
// exchanges server-side) are untouched. If the exchange fails (expired
// code), it cleans the dead tokens out of the address bar instead of
// leaving them visible on the landing page.
export const RECOVERY_REDIRECT_FLAG = "scholars.recovery_redirect";

export function AuthRescue() {
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (pathname !== "/" || handled.current) return;
    const url = new URL(window.location.href);
    const hasTokens =
      url.searchParams.has("code") || url.hash.includes("access_token=");
    if (!hasTokens) return;
    handled.current = true;

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
    // strip the dead tokens so the landing page renders cleanly.
    const t = setTimeout(() => {
      if (!routed) window.history.replaceState(null, "", "/");
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [pathname, router]);

  return null;
}
