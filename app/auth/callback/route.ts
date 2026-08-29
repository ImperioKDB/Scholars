// app/auth/callback/route.ts
// GET /auth/callback?code=...&next=/dashboard
//
// Handles both the Google OAuth redirect and the email-confirmation link.
// Both flows land the browser here with a `code` query param that has to
// be exchanged for a session via the server client -- without this route,
// signInWithOAuth's redirectTo (and the confirmation email's
// emailRedirectTo) send the browser straight to a protected page with no
// session yet, and middleware.ts bounces it back to /login. That bounce
// is what "Google sign-in dumps me back on the login page" actually was.
//
// `next` defaults to /dashboard so any redirect that forgets to pass it
// still lands somewhere sensible rather than erroring.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed (expired/already-used link, etc.) --
  // send them to login with a message rather than a silent redirect loop.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Could not sign you in. The link may have expired -- please try again."
    )}`
  );
}
