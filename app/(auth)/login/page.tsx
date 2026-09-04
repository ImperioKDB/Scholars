"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";

// AUTH SECURITY AUDIT (brute-force brake, client side): progressive
// lockout stored in localStorage. This is UX-level only -- a determined
// attacker bypasses it trivially -- the real brakes are Supabase's own
// server-side auth rate limits. What this adds is honest feedback and a
// slowdown for casual credential-stuffing against a real device.
const LOCK_KEY = "scholars_login_lockout";
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
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      const count = lock.count + 1;
      // 5th consecutive failure starts a 30s backoff, doubling each time,
      // capped at 5 minutes. A success clears it entirely.
      const until = count >= 5 ? Date.now() + Math.min(30_000 * 2 ** (count - 5), 300_000) : 0;
      writeLock({ count, until });
      setError("That email and password don't match an account.");
      return;
    }
    clearLock();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    // Route through /auth/callback rather than straight to /dashboard --
    // that's the route that actually exchanges Google's ?code= for a
    // session before landing on a protected page. See
    // app/auth/callback/route.ts.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
  }

  return (
    <AuthShell heading="Welcome back" sub="Log in to see your latest matches.">
      {error && (
        <p className="text-sm text-rose bg-rose-light rounded-lg px-3.5 py-2.5 mb-5">{error}</p>
      )}
      <form onSubmit={handleSubmit} noValidate>
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
        <FormField label="Password">
          <input
            className={inputClass}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? "Logging in\u2026" : "Log in"}
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
        {googleLoading ? "Redirecting\u2026" : "Continue with Google"}
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

// useSearchParams() requires a Suspense boundary in the App Router --
// wrapping here (rather than inside AuthShell) keeps AuthShell reusable
// for pages that don't need query params.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
