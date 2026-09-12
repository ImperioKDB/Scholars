import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAMES, REF_COOKIE_MAX_AGE_S } from "@/lib/config";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/discover", "/opportunities", "/saved", "/applications", "/admin", "/scholarships", "/settings"];
const AUTH_PREFIXES = ["/login", "/signup"];

// INPUT HARDENING: ?ref= is attacker-controllable query input that ends up
// in a cookie and later in profiles.referred_by. Only a well-formed UUID
// passes. Inlined (not imported from lib/validate.ts) to keep the edge
// middleware bundle free of zod. app/auth/callback re-validates before the
// value ever reaches the database.
const REF_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// AUTH SECURITY AUDIT: session cookies written server-side are pinned to
// SameSite=lax and Secure in production. Secure is safe here because
// Vercel serves HTTPS-only; dev (http) keeps the default so local work
// still functions. SameSite=lax is the CSRF brake for a cookie the
// browser client can read (Supabase's SSR architecture cannot make it
// HttpOnly -- see lib/supabase/server.ts note).
function hardened(options: CookieOptions): CookieOptions {
  return {
    ...options,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" ? true : options.secure,
  };
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // PERF (batch 1): /s/** (scholarships) and /o/** (opportunities) are the
  // public growth surfaces. Capturing the referral cookie needs no session,
  // so return BEFORE the Supabase auth round trip. Every share-page visit
  // previously paid a full getUser() network call (~50-150ms) for nothing.
  //
  // This early return also sidesteps the cookies.set() reassignment trap
  // documented further down: we build our own response object here and
  // set the ref cookie on it directly, so no Supabase callback can swap
  // it out from under us.
  if (path.startsWith("/s/") || path.startsWith("/o/")) {
    const shareResponse = NextResponse.next();
    const ref = request.nextUrl.searchParams.get("ref");
    const alreadyHasRef = request.cookies.get(COOKIE_NAMES.REF)?.value;
    const consentChoice = request.cookies.get(COOKIE_NAMES.CONSENT)?.value;

    // Honor a rejected consent choice: no referral credit cookie for
    // browsers that declined. Accept (or no recorded choice yet) keeps
    // the previous behavior. UUID gate added: anything that isn't a
    // profile id is dropped at the door.
    if (ref && REF_UUID_RE.test(ref) && !alreadyHasRef && consentChoice !== "rejected") {
      shareResponse.cookies.set(COOKIE_NAMES.REF, ref, {
        maxAge: REF_COOKIE_MAX_AGE_S,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return shareResponse;
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...hardened(options) });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => path.startsWith(p));

  // AUTH SECURITY AUDIT (server-side authorization, defense in depth):
  // every /api/admin/** handler already checks is_admin server-side, and
  // RLS enforces admin writes at the database. This gate makes the
  // middleware a second, independent enforcement point, so a handler that
  // ever forgets its check cannot leak the admin list. JSON responses
  // (not redirects) because these are fetch() calls from the admin UI.
  if (path.startsWith("/api/admin")) {
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/discover/:path*",
    "/opportunities/:path*",
    "/saved/:path*",
    "/applications/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/scholarships/:path*",
    "/settings/:path*",
    "/s/:path*",
    "/o/:path*",
    "/login",
    "/signup",
  ],
};
