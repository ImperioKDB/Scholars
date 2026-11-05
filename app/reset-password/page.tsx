"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { AuthOtp } from "@/components/AuthOtp";
import { FormField, inputClass } from "@/components/FormField";
import { PasswordField } from "@/components/PasswordField";
import { StatusMessage } from "@/components/StatusMessage";
import { normalizeEmail } from "@/lib/auth/email";
import { validatePasswordStrength } from "@/lib/auth/password";
import { SpinnerIcon } from "@/components/icons";

const THROTTLE_KEY = "scholars_reset_throttle";
const THROTTLE_WINDOW_MS = 10 * 60_000;
const THROTTLE_MAX = 3;
type Stage = "request" | "otp" | "update" | "done";

function throttleError(): string | null {
  try {
    const now = Date.now();
    const arr = (JSON.parse(localStorage.getItem(THROTTLE_KEY) ?? "[]") as number[]).filter(
      (time) => now - time < THROTTLE_WINDOW_MS,
    );
    if (arr.length >= THROTTLE_MAX) return "Too many reset requests from this browser. Try again in a few minutes.";
    arr.push(now);
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(arr));
  } catch {
    // Supabase's server-side limits remain the hard backstop.
  }
  return null;
}

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cleanEmail = normalizeEmail(email);

  async function requestRecovery(): Promise<boolean> {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (resetError) {
      setError(resetError.code === "over_email_send_rate_limit"
        ? "We have sent too many requests to this address. Please wait a few minutes and try again."
        : "We couldn't send a reset code right now. Please try again shortly.");
      return false;
    }
    return true;
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const throttled = throttleError();
    if (throttled) { setError(throttled); return; }
    setLoading(true);
    const accepted = await requestRecovery();
    setLoading(false);
    if (!accepted) return;
    setVerificationEmail(cleanEmail);
    setStage("otp");
  }

  async function handleVerify(token: string): Promise<string | null> {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: verificationEmail ?? cleanEmail,
      token,
      type: "recovery",
    });
    if (verifyError) return "That code is invalid or has expired. Request a new code and try again.";
    setStage("update");
    return null;
  }

  async function handleResend(): Promise<string | null> {
    return (await requestRecovery()) ? null : "We couldn't send a new code right now. Please try again shortly.";
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const issues = validatePasswordStrength(password);
    if (issues.length > 0) { setError("Password needs " + issues.join(", ") + "."); return; }
    if (password !== confirmPassword) { setError("Your passwords do not match."); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError("We couldn't update your password. Please request a new code and try again."); return; }
    setStage("done");
  }

  if (stage === "otp" && verificationEmail) {
    return <AuthOtp email={verificationEmail} purpose="recovery" onVerify={handleVerify} onResend={handleResend} onBack={() => { setStage("request"); setVerificationEmail(null); }} />;
  }

  if (stage === "update") {
    return (
      <AuthShell heading="Set a new password" sub="Choose something you haven&apos;t used before.">
        {error && <StatusMessage tone="error" className="mb-5">{error}</StatusMessage>}
        <form onSubmit={handleUpdate} noValidate>
          <FormField label="New password" error={error?.startsWith("Password") ? error : undefined} hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number.">
            <PasswordField value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm password" error={error === "Your passwords do not match." ? error : undefined}>
            <PasswordField value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" autoComplete="new-password" />
          </FormField>
          <button type="submit" disabled={loading} aria-busy={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:opacity-60">
            {loading && <SpinnerIcon className="h-4 w-4" />}{loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (stage === "done") {
    return (
      <AuthShell heading="Password updated" sub="You&apos;re all set.">
        <div className="rounded-xl border border-hairline bg-emerald-light p-5 mb-6"><p className="text-sm text-ink">Your password has been changed. You can log in with it now.</p></div>
        <Link href="/login" className="block w-full rounded-lg bg-navy text-white font-medium py-3 text-center hover:bg-navy-light transition-colors">Return to log in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Reset your password" sub="We&apos;ll email you a six-digit reset code.">
      {error && <StatusMessage tone="error" className="mb-5">{error}</StatusMessage>}
      {notice && <StatusMessage tone="success" className="mb-5">{notice}</StatusMessage>}
      <form onSubmit={handleRequest} noValidate>
        <FormField label="Email" error={error ?? undefined}>
          <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu.ng" autoComplete="email" />
        </FormField>
        {loading && <div className="mb-3 flex items-center gap-3 rounded-xl border border-hairline bg-navy-50 px-4 py-3 text-sm text-navy-light" role="status"><SpinnerIcon className="h-4 w-4 shrink-0 text-emerald" /><span>Sending your reset code. This usually takes a few seconds.</span></div>}
        <button type="submit" disabled={loading} aria-busy={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:cursor-wait disabled:opacity-60">
          {loading && <SpinnerIcon className="h-4 w-4" />}<span>{loading ? "Sending reset code…" : "Send reset code"}</span>
        </button>
      </form>
      <p className="text-sm text-navy-light mt-8 text-center">Remembered it?{" "}<Link href="/login" className="text-navy font-medium hover:underline">Log in</Link></p>
    </AuthShell>
  );
}
