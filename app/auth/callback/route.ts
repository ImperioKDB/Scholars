// app/auth/callback/route.ts
// GET /auth/callback?code=...&next=/dashboard
//
// Handles both the Google OAuth redirect and the email-confirmation link.
// Both flows land the browser here with a `code` query param that has to
// be exchanged for a session via the server client -- without this route,
// signInWithOAuth's redirectTo (and the confirmation email's
// emailRedirectTo) send the browser straight to a protected page with no
// session yet, and middleware.ts bounces it back to /login.
//
// `next` defaults to /dashboard so any redirect that forgets to pass it
// still lands somewhere sensible rather than erroring.
//
// REFERRAL ATTRIBUTION: if a ref_id cookie is present (set by
// middleware.ts the moment someone visits a /s/[id] share link before
// signing up), stamp it onto the new user's profiles.referred_by the
// first time their session is established here. This route is the one
// place every signup path -- Google OAuth AND email/password +
// confirmation -- funnels through, so it's the single correct place to
// consume the cookie rather than duplicating this in both auth pages.
// Guarded with .is('referred_by', null) so it can only ever be set once
// per profile, and the cookie is cleared right after so a returning user
// who logs out and back in on the same device doesn't get re-attributed.
// A failure here is logged but never blocks sign-in -- attribution is a
// growth metric, not something worth failing auth over.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const REF_COOKIE_NAME = "ref_id";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const cookieStore = cookies();
      const refId = cookieStore.get(REF_COOKIE_NAME)?.value;

      if (refId && refId !== data.user.id) {
        const { error: attributionError } = await supabase
          .from("profiles")
          .update({ referred_by: refId })
          .eq("id", data.user.id)
          .is("referred_by", null);

        if (attributionError) {
          console.error("Referral attribution failed:", attributionError.message);
        }

        cookieStore.set(REF_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      }

      return NextResponse.redirect(origin + next);
    }
  }

  return NextResponse.redirect(
    origin +
      "/login?error=" +
      encodeURIComponent("Could not sign you in. The link may have expired -- please try again.")
  );
}
