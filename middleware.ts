import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/discover", "/saved", "/applications", "/admin", "/scholarships", "/settings"];
const AUTH_PREFIXES = ["/login", "/signup"];

const REF_COOKIE_NAME = "ref_id";
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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

  const path = request.nextUrl.pathname;
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

  // Referral attribution: capture ?ref=<sharer_profile_id> from a public
  // share link (see components/ShareButton.tsx, app/s/[id]/page.tsx) into
  // a cookie, so it survives the redirect chain into signup and gets
  // consumed once in app/auth/callback/route.ts. First-touch wins -- never
  // overwrite an existing ref_id, so opening a second share link before
  // signing up doesn't silently reassign who gets credit.
  //
  // This block MUST run after the Supabase getUser() call above, not
  // before it. The cookies.set() callback wired into createServerClient
  // reassigns `response` to a brand-new NextResponse.next() instance
  // whenever Supabase needs to refresh a session cookie -- setting the ref
  // cookie on the original `response` earlier in this function would be
  // silently discarded the moment that reassignment happens.
  if (path.startsWith("/s/")) {
    const ref = request.nextUrl.searchParams.get("ref");
    const alreadyHasRef = request.cookies.get(REF_COOKIE_NAME)?.value;
    if (ref && !alreadyHasRef) {
      response.cookies.set(REF_COOKIE_NAME, ref, {
        maxAge: REF_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/discover/:path*",
    "/saved/:path*",
    "/applications/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/scholarships/:path*",
    "/settings/:path*",
    "/s/:path*",
    "/login",
    "/signup",
  ],
};
