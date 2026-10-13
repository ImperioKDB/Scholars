import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAMES, REF_COOKIE_MAX_AGE_S } from "@/lib/config";
import { getAuthCookieDomain } from "@/lib/auth/cookie-domain";
import { mergeSupabaseSessionCookies } from "@/lib/auth/pwa-session";

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
  const hostname = request.nextUrl.hostname.toLowerCase();
  const attributionResponse = NextResponse.next();
  const attributionCookie = request.cookies.get(COOKIE_NAMES.ATTRIBUTION)?.value;
  const params = request.nextUrl.searchParams;
  const attribution = {
    referral_source: params.get("referral_source") || (params.get("ref") ? "referral" : ""),
    campaign_id: params.get("campaign_id") || "",
    ambassador_code: params.get("ambassador_code") || "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
  };
  if (Object.values(attribution).some((value) => value.trim().length > 0) && !attributionCookie) {
    const bounded = Object.fromEntries(
      Object.entries(attribution).map(([key, value]) => [key, value.trim().slice(0, 120)])
    );
    attributionResponse.cookies.set(COOKIE_NAMES.ATTRIBUTION, encodeURIComponent(JSON.stringify(bounded)), {
      maxAge: REF_COOKIE_MAX_AGE_S,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  if (
    path.startsWith("/s/") ||
    path.startsWith("/o/") ||
    path.startsWith("/scholarship/") ||
    path.startsWith("/opportunity/")
  ) {
    const shareResponse = attributionResponse;
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
  const pendingCookieMutations = new Map<
    string,
    { value: string; options: CookieOptions }
  >();
  function applyCookieMutation(name: string, value: string, options: CookieOptions) {
    request.cookies.set({ name, value, ...options });
    pendingCookieMutations.set(name, { value, options: hardened(options) });
    // Rebuild the forwarded request after cookie changes so downstream
    // server components see the refreshed session. Reapply every mutation
    // because Supabase can update several cookie chunks during one refresh.
    response = NextResponse.next({ request: { headers: request.headers } });
    for (const [cookieName, cookie] of pendingCookieMutations) {
      response.cookies.set(cookieName, cookie.value, cookie.options);
    }
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        ...(process.env.VERCEL_ENV === "production"
          ? { domain: getAuthCookieDomain("www.scholars.com.ng") }
          : {}),
      },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          applyCookieMutation(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          applyCookieMutation(name, "", options);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  const isAuthPage = AUTH_PREFIXES.some((prefix) => path.startsWith(prefix));

  // Keep launches on the canonical www origin used by the PWA manifest and
  // OAuth callback. Older apex installs can migrate their validated session
  // once; canonical www installs must never be redirected out of their scope.
  if (
    process.env.VERCEL_ENV === "production" &&
    hostname === "scholars.com.ng" &&
    (path === "/" || isProtected || isAuthPage)
  ) {
    const canonicalUrl = new URL(request.url);
    canonicalUrl.hostname = "www.scholars.com.ng";
    const redirectResponse = NextResponse.redirect(canonicalUrl);
    if (user) {
      const migratedCookies = mergeSupabaseSessionCookies(
        request.cookies.getAll(),
        response.cookies.getAll()
      );
      const cookieDomain = getAuthCookieDomain(hostname);
      if (cookieDomain) {
        for (const cookie of migratedCookies) {
          // Remove any old apex-only copy, then reissue the validated session
          // cookie at the shared Scholars domain so the canonical PWA can read
          // it. Supabase still validates every use.
          // Next's cookie helper indexes by cookie name and would collapse
          // the host-only expiry into the Domain cookie below. Append the
          // expiry separately so both scopes are updated in the same redirect.
          redirectResponse.headers.append(
            "Set-Cookie",
            `${cookie.name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax`
          );
          redirectResponse.cookies.set(cookie.name, cookie.value, {
            domain: cookieDomain,
            path: "/",
            maxAge: cookie.value ? 400 * 24 * 60 * 60 : 0,
            sameSite: "lax",
            secure: true,
          });
        }
      }
    }
    return redirectResponse;
  }

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
    redirectUrl.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }
  // Older installed PWAs launch at `/`. If the persisted Supabase session is
  // present, take the user directly to the dashboard instead of the public
  // landing page or its login CTA.
  if (path === "/" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  const attributionHeader = attributionResponse.cookies.get(COOKIE_NAMES.ATTRIBUTION);
  if (attributionHeader) response.cookies.set(attributionHeader);
  return response;
}

export const config = {
  matcher: [
    "/",
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
