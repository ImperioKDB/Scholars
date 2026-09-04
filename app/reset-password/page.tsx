"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";

// app/reset-password/page.tsx
// GET /reset-password
//
// Step 1 of the password reset flow. Sends a recovery email via
// supabase.auth.resetPasswordForEmail(), redirecting the link inside that
// email to /reset-password/update, which is where the actual new password
// gets set. This route was previously linked from the login page
// (app/(auth)/login/page.tsx) but did not exist.
//
// Deliberately shows the same "check your email" message whether or not
// the address has an account -- do not reveal account existence via this
// form.
//
// AUTH SECURITY AUDIT (reset abuse brake): max 3 sends per 10 minutes per
// browser, on top of Supabase's server-side email rate limits. Client-side
// like the login lockout -- the server limits are the hard backstop.
const THROTTLE_KEY = "scholars_reset_throttle";
const THROTTLE_WINDOW_MS = 10 * 60_000;
const THROTTLE_MAX = 3;

function throttleError(): string | null {
  try {
    const now = Date.now();
    const arr = (JSON.parse(localStorage.getItem(THROTTLE_KEY) ?? "[]") as number[]).filter(
      (t) => now - t < THROTTLE_WINDOW_MS
    );
    if (arr.length >= THROTTLE_MAX) {
      return "Too many reset requests from this browser. Try again in a few minutes.";
    }
    arr.push(now);
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(arr));
  } catch {
    // storage blocked -- degrade to no throttle, Supabase still limits
  }
  return null;
}

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const throttled = throttleError();
    if (throttled) {
      setError(throttled);
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/update`,
    });
    setLoading(false);
    if (resetError) {
      setError("Couldn't send a reset link right now. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell heading="Check your email" sub="One more step before you're back in.">
        <div className="rounded-xl border border-hairline bg-navy-50 p-5 mb-6">
          <p className="text-sm text-ink">
            If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a link to
            reset your password. It expires after a while, so use it soon.
          </p>
        </div>
        <p className="text-sm text-navy-light text-center">
          <Link href="/login" className="text-navy font-medium hover:underline">
            Back to log in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Reset your password" sub="We'll email you a link to set a new one.">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" error={error ?? undefined}>
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {loading ? "Sending\u2026" : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-navy-light mt-8 text-center">
        Remembered it?{" "}
        <Link href="/login" className="text-navy font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
