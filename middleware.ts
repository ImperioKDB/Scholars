import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAMES, REF_COOKIE_MAX_AGE_S } from "@/lib/config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/discover",
  "/opportunities",
  "/saved",
  "/applications",
  "/admin",
  "/scholarships",
  "/settings",
];
const AUTH_PREFIXES = ["/login", "/signup"];
const REF_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hardened(options: CookieOptions): CookieOptions {
  return {
    ...options,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" ? true : options.secure,
  };
}

function adminMfaRequired(): boolean {
  return process.env.REQUIRE_ADMIN_MFA === "true";
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    path.startsWith("/s/") ||
    path.startsWith("/o/") ||
    path.startsWith("/scholarship/") ||
    path.startsWith("/opportunity/")
  ) {
    const shareResponse = NextResponse.next();
    const ref = request.nextUrl.searchParams.get("ref");
    const alreadyHasRef = request.cookies.get(COOKIE_NAMES.REF)?.value;
    const consentChoice = request.cookies.get(COOKIE_NAMES.CONSENT)?.value;
    if (
      ref &&
      REF_UUID_RE.test(ref) &&
      !alreadyHasRef &&
      consentChoice !== "rejected"
    ) {
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
          response.cookies.set({ name, value: "", ...hardened(options) });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  const isAuthPage = AUTH_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (path.startsWith("/api/admin")) {
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (adminProfile?.is_admin !== true) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    if (adminMfaRequired()) {
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2" || aal?.nextLevel !== "aal2") {
        return NextResponse.json(
          { error: "Multi-factor authentication required" },
          { status: 403 }
        );
      }
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
    "/scholarship/:path*",
    "/opportunity/:path*",
    "/login",
    "/signup",
  ],
};
