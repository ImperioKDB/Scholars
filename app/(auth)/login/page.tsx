"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";
import { PasswordField } from "@/components/PasswordField";
import { normalizeEmail } from "@/lib/auth/email";
import { Skeleton } from "@/components/Skeleton";
import { AuthConfirmation } from "@/components/AuthConfirmation";

// AUTH SECURITY AUDIT (brute-force brake, client side): progressive
// lockout stored in localStorage. UX-level only -- the real brakes are
// Supabase's own server-side auth rate limits.
const LOCK_KEY = "scholars_login_lockout";

// REDIRECT FIX (test feedback): OAuth and confirmation redirects now use
// the canonical app URL from NEXT_PUBLIC_APP_URL when set, instead of
// whatever origin the browser happens to be on. A preview or stale custom
// domain that isn't in Supabase's redirect allowlist gets silently
// replaced by the Site URL (the homepage flash testers saw); pointing
// every flow at the canonical origin keeps the allowlist match stable.
function appBase(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_APP_URL || "";
  return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
}

type LockState = { count: number; until: number };

function readLock(): LockState {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return { count: 0, until: 0 };
    const parsed = JSON.parse(raw) as Partial<LockState>;
    return { count: parsed.count ?? 0, until: parsed.until ?? 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

function writeLock(lock: LockState) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  } catch {
    // storage blocked -- lockout degrades to per-page state, fine
  }
}

function clearLock() {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    // ignore
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const cleanEmail = normalizeEmail(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lock = readLock();
    if (lock.until > Date.now()) {
      const secs = Math.ceil((lock.until - Date.now()) / 1000);
      setError(`Too many failed attempts. Try again in ${secs} second${secs === 1 ? "" : "s"}.`);
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setLoading(false);
    if (signInError) {
      if (signInError.code === "email_not_confirmed" || signInError.message.toLowerCase().includes("email not confirmed")) {
        const { error: resendError } = await supabase.auth.resend({ type: "signup", email: cleanEmail });
        if (resendError) {
          setError("Your email is not confirmed yet, and we couldn't resend the link. Try again shortly or check your inbox for the original link.");
        } else {
          setConfirmationEmail(cleanEmail);
        }
        return;
      }
      const count = lock.count + 1;
      const until = count >= 5 ? Date.now() + Math.min(30_000 * 2 ** (count - 5), 300_000) : 0;
      writeLock({ count, until });
      setError("That password didn’t work. Check it and try again, or use Forgot password.");
      return;
    }
    clearLock();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${appBase()}/auth/callback?next=/dashboard` },
    });
  }

  async function handleResendConfirmation(): Promise<string | null> {
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: confirmationEmail ?? "" });
    return resendError ? "We couldn't resend the link right now. Please try again shortly." : null;
  }

  if (confirmationEmail) {
    return <AuthConfirmation email={confirmationEmail} onResend={handleResendConfirmation} />;
  }

  return (
    <AuthShell heading="Welcome back" sub="Log in to see your latest matches.">
      {error && (
        <p className="text-sm text-rose bg-rose-light rounded-lg px-3.5 py-2.5 mb-5" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" id="login-email">
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
        <FormField label="Password" id="login-password">
          <PasswordField
            id="login-password"
            value={password}
            onChange={setPassword}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </FormField>
        <div className="text-right mb-2">
          <Link href="/reset-password" className="text-xs text-navy-light hover:text-navy">
            Forgot password?
          </Link>
        </div>
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
          {loading ? "Logging in…" : "Log in"}
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
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-navy font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell heading="Welcome back" sub="Sign in to see your scholarship matches.">
          <div aria-busy="true" aria-label="Loading sign-in form" className="space-y-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-12 w-full mt-2" />
          </div>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
