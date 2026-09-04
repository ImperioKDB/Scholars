import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// AUDIT FIX (batch 5): /settings added -- the new profile overview page
// shows personal data, so it's gated to authenticated users like the
// rest of the app shell.
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/discover", "/saved", "/applications", "/admin", "/scholarships", "/settings"];
const AUTH_PREFIXES = ["/login", "/signup"];

const REF_COOKIE_NAME = "ref_id";
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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
          response.cookies.set({ name, value, ...options });
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
    "/scholarships/:path*",
    "/settings/:path*",
    "/s/:path*",
    "/login",
    "/signup",
  ],
};
