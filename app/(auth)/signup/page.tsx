"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";

// Shown after a successful signUp() call when Supabase did NOT return a
// live session -- i.e. email confirmation is required. Sending someone to
// /onboarding at this point is a dead end: it's a protected route, there's
// no session yet, and middleware.ts just bounces them to /login, a page
// that can't do anything for an account that isn't confirmed yet.
function CheckEmailScreen({ email, onResend }: { email: string; onResend: () => Promise<void> }) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);
    setResent(false);
    await onResend();
    setResending(false);
    setResent(true);
  }

  return (
    <AuthShell heading="Check your email" sub="One more step before you can sign in.">
      <div className="rounded-xl border border-hairline bg-navy-50 p-5 mb-6">
        <p className="text-sm text-ink">
          We sent a confirmation link to <span className="font-medium">{email}</span>. Click it
          to activate your account, then come back and log in.
        </p>
      </div>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="w-full rounded-lg border border-hairline bg-white py-2.5 text-sm font-medium text-ink hover:bg-navy-50 transition-colors disabled:opacity-60"
      >
        {resending ? "Sending…" : resent ? "Sent again ✓" : "Resend confirmation email"}
      </button>

      <p className="text-sm text-navy-light mt-8 text-center">
        Already confirmed?{" "}
        <Link href="/login" className="text-navy font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // A session on the response means email confirmation is off for this
    // project -- the account is immediately usable, so go straight in.
    // No session means a confirmation link was sent instead.
    if (data.session) {
      router.push("/onboarding");
      return;
    }

    setAwaitingConfirmation(true);
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
  }

  async function handleResend() {
    await supabase.auth.resend({ type: "signup", email });
  }

  if (awaitingConfirmation) {
    return <CheckEmailScreen email={email} onResend={handleResend} />;
  }

  return (
    <AuthShell
      heading="Create your account"
      sub="Start discovering scholarships in minutes."
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Full name">
          <input
            className={inputClass}
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
          />
        </FormField>

        <FormField label="Email">
          <input
            className={inputClass}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu.ng"
            autoComplete="email"
          />
        </FormField>

        <FormField label="Password" error={error ?? undefined}>
          <input
            className={inputClass}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </FormField>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-hairline" />
        <span className="text-xs text-navy-light">or continue with</span>
        <div className="h-px flex-1 bg-hairline" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white py-2.5 text-sm font-medium text-ink hover:bg-navy-50 transition-colors disabled:opacity-60"
      >
        {googleLoading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <p className="text-sm text-navy-light mt-8 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-navy font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
