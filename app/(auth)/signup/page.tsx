"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";
import { StatusMessage } from "@/components/StatusMessage";
import { PasswordField } from "@/components/PasswordField";
import { AuthOtp } from "@/components/AuthOtp";
import { validatePasswordStrength } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/email";
import { safeNextPath } from "@/lib/validate";
import { AUTH_NEXT_COOKIE } from "@/components/AuthRescue";
import { getAuthCookieDomain } from "@/lib/auth/cookie-domain";
import { getAuthRedirectOrigin } from "@/lib/auth/redirect-origin";
import { recordConfirmationEmailEvent } from "@/lib/auth/confirmation-email-analytics";

function appBase(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_APP_URL || "";
  return getAuthRedirectOrigin(window.location.origin, process.env.NEXT_PUBLIC_APP_URL);
}
function rememberAuthNext(next: string) {
  const domain = getAuthCookieDomain(window.location.hostname);
  const domainAttribute = domain ? `; Domain=${domain}` : "";
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Max-Age=600; Path=/; SameSite=Lax${domainAttribute}${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/onboarding");
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const cleanEmail = normalizeEmail(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const issues = validatePasswordStrength(password);
    if (issues.length > 0) {
      setError("Password needs " + issues.join(", ") + ".");
      return;
    }
    setLoading(true);
    rememberAuthNext(next);
    let breached = false;
    try {
      const leakRes = await fetch("/api/auth/password-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (leakRes.ok) {
        breached = (await leakRes.json()).leaked === true;
      }
    } catch {
      // fail open
    }
    if (breached) {
      setLoading(false);
      setError("This password appears in known breach data. Pick something less common.");
      return;
    }
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (signUpError) {
      void recordConfirmationEmailEvent({
        email: cleanEmail,
        kind: "signup",
        status: "failed",
        errorCode: signUpError.code ?? "auth_error",
      });
      if (signUpError.code === "user_already_registered") {
        setError("An account with this email already exists. Try logging in or resetting your password.");
      } else if (signUpError.code === "over_email_send_rate_limit") {
        setError("We have sent too many emails to this address. Please wait a few minutes and try again.");
      } else {
        setError("We couldn't create your account. Check your details and try again.");
      }
      return;
    }
    if (!data.session) {
      void recordConfirmationEmailEvent({
        email: cleanEmail,
        kind: "signup",
        status: "accepted",
        userId: data.user?.id,
      });
    }
    if (data.session) {
      router.push(next);
      return;
    }
    setVerificationEmail(cleanEmail);
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appBase()}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  async function handleVerify(token: string): Promise<string | null> {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: verificationEmail ?? cleanEmail,
      token,
      type: "signup",
    });
    if (verifyError) return "That code is invalid or has expired. Request a new code and try again.";
    if (!data.session) return "Your email was verified, but we couldn't start your session. Please log in.";
    router.push(next);
    router.refresh();
    return null;
  }

  async function handleResend(): Promise<string | null> {
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: cleanEmail });
    void recordConfirmationEmailEvent({
      email: cleanEmail,
      kind: "resend",
      status: resendError ? "failed" : "accepted",
      errorCode: resendError?.code ?? null,
    });
    return resendError ? "We couldn't send a new code right now. Please try again shortly." : null;
  }

  if (verificationEmail) {
    return (
      <AuthOtp
        email={verificationEmail}
        purpose="signup"
        onVerify={handleVerify}
        onResend={handleResend}
        onBack={() => setVerificationEmail(null)}
      />
    );
  }

  return (
    <AuthShell
      heading="Create your account"
      sub="Start discovering scholarships in minutes."
    >
      {error && <StatusMessage tone="error" className="mb-5">{error}</StatusMessage>}
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Full name" id="signup-full-name">
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
        <FormField label="Email" id="signup-email">
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
        <FormField
          label="Password"
          id="signup-password"
          error={error?.startsWith("Password") ? error : undefined}
          hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
        >
          <PasswordField
            id="signup-password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </FormField>
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
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
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        aria-busy={googleLoading}
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
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-navy font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
