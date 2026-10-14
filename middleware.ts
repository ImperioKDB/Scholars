import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAMES, REF_COOKIE_MAX_AGE_S } from "@/lib/config";
import { getAuthCookieDomain } from "@/lib/auth/cookie-domain";
import {
  getSupabaseSessionCookieNames,
  mergeSupabaseSessionCookies,
} from "@/lib/auth/pwa-session";

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

const AUTH_COOKIE_SCOPE_MARKER = "scholars_auth_cookie_scope_v1";
const AUTH_COOKIE_SCOPE_MAX_AGE = 400 * 24 * 60 * 60;

function expireHostOnlySessionCookies(
  response: NextResponse,
  cookieNames: readonly string[]
) {
  for (const name of new Set(cookieNames)) {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax`
    );
  }
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
  const authCookieDomain =
    process.env.VERCEL_ENV === "production"
      ? getAuthCookieDomain(hostname)
      : undefined;
  const hostOnlyCookiesToExpire = new Set<string>();
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
        ...(authCookieDomain ? { domain: authCookieDomain } : {}),
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
    error: authError,
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
    redirectUrl.searchParams.set("next", path + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Remove only an invalid host-only copy. A valid parent-domain cookie is
    // left untouched so the browser can retry it on the login request.
    if (authCookieDomain && (!authError || authError.status === 401)) {
      expireHostOnlySessionCookies(
        redirectResponse,
        getSupabaseSessionCookieNames(request.cookies.getAll())
      );
    }
    return redirectResponse;
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
  if (authCookieDomain && isProtected && user) {
    const requestSessionCookieNames = getSupabaseSessionCookieNames(
      request.cookies.getAll()
    );
    if (request.cookies.get(AUTH_COOKIE_SCOPE_MARKER)?.value !== "1") {
      const requestSessionCookies = requestSessionCookieNames.map((name) => ({
        name,
        value: request.cookies.get(name)?.value ?? "",
      }));
      const sessionCookies = mergeSupabaseSessionCookies(
        requestSessionCookies,
        response.cookies.getAll()
      );
      for (const cookie of sessionCookies) {
        applyCookieMutation(cookie.name, cookie.value, {
          domain: authCookieDomain,
          path: "/",
          maxAge: cookie.value ? AUTH_COOKIE_SCOPE_MAX_AGE : 0,
          sameSite: "lax",
          secure: true,
        });
      }
      for (const name of requestSessionCookieNames) {
        hostOnlyCookiesToExpire.add(name);
      }
      response.cookies.set(AUTH_COOKIE_SCOPE_MARKER, "1", {
        path: "/",
        maxAge: AUTH_COOKIE_SCOPE_MAX_AGE,
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      });
    }
  }
  if (
    authCookieDomain &&
    isAuthPage &&
    !user &&
    authError?.status === 401
  ) {
    for (const name of getSupabaseSessionCookieNames(request.cookies.getAll())) {
      hostOnlyCookiesToExpire.add(name);
    }
  }
  const attributionHeader = attributionResponse.cookies.get(COOKIE_NAMES.ATTRIBUTION);
  if (attributionHeader) response.cookies.set(attributionHeader);
  expireHostOnlySessionCookies(response, [...hostOnlyCookiesToExpire]);
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
