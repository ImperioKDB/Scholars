"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { StatusMessage } from "@/components/StatusMessage";
import { SpinnerIcon } from "@/components/icons";

// Supabase Email OTP length is configured to six digits. Keep this aligned
// with Authentication > Sign In / Providers > Email > Email OTP length.
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

type Props = {
  email: string;
  purpose: "signup" | "recovery";
  onVerify: (token: string) => Promise<string | null>;
  onResend: () => Promise<string | null>;
  onGoogle?: () => Promise<string | null>;
  onBack?: () => void;
};

export function AuthOtp({ email, purpose, onVerify, onResend, onGoogle, onBack }: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  async function verify(value: string) {
    if (value.length !== OTP_LENGTH || verifying || submittedRef.current) return;
    submittedRef.current = true;
    setVerifying(true);
    setError(null);
    setNotice(null);
    let verifyError: string | null;
    try {
      verifyError = await onVerify(value);
    } catch {
      verifyError = "We couldn't verify the code because of a network problem. Please try again.";
    }
    if (verifyError) {
      submittedRef.current = false;
      setVerifying(false);
      setDigits(Array(OTP_LENGTH).fill(""));
      setError(verifyError);
      inputRefs.current[0]?.focus();
    }
  }

  function updateDigit(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(null);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    const code = next.join("");
    if (code.length === OTP_LENGTH) void verify(code);
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((digit, offset) => {
      if (index + offset < OTP_LENGTH) next[index + offset] = digit;
    });
    setDigits(next);
    const code = next.join("");
    if (code.length === OTP_LENGTH) void verify(code);
    else inputRefs.current[Math.min(index + pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  async function handleResend() {
    if (resending || verifying || secondsLeft > 0) return;
    setResending(true);
    setError(null);
    setNotice(null);
    let resendError: string | null;
    try {
      resendError = await onResend();
    } catch {
      resendError = "We couldn't send a new code because of a network problem. Please try again shortly.";
    }
    setResending(false);
    if (resendError) {
      setError(resendError);
      return;
    }
    submittedRef.current = false;
    setDigits(Array(OTP_LENGTH).fill(""));
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    setNotice("A new six-digit code is on its way.");
    inputRefs.current[0]?.focus();
  }

  async function handleGoogle() {
    if (!onGoogle || googleLoading || verifying) return;
    setGoogleLoading(true);
    setError(null);
    setNotice(null);
    try {
      const googleError = await onGoogle();
      if (googleError) {
        setGoogleLoading(false);
        setError(googleError);
      }
    } catch {
      setGoogleLoading(false);
      setError("We couldn't start Google sign-in. Please try again.");
    }
  }

  const heading = purpose === "signup" ? "Verify your email" : "Enter your reset code";
  const sub = purpose === "signup"
    ? "One quick step before you start discovering scholarships."
    : "Use the code to continue securely to a new password.";

  return (
    <AuthShell heading={heading} sub={sub}>
      <div className="rounded-xl border border-hairline bg-navy-50 p-5 mb-6" aria-live="polite">
        <p className="text-sm leading-relaxed text-ink">
          We sent a six-digit code to <span className="font-medium break-all">{maskEmail(email)}</span>.
          It expires soon. Don&apos;t share it with anyone.
        </p>
      </div>
      {error && <StatusMessage tone="error" className="mb-4">{error}</StatusMessage>}
      {notice && <StatusMessage tone="success" className="mb-4">{notice}</StatusMessage>}
      <fieldset disabled={verifying}>
        <legend className="sr-only">Six-digit verification code</legend>
        <div className="flex justify-between gap-1.5 sm:gap-2" role="group" aria-label="Six-digit verification code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => { inputRefs.current[index] = element; }}
              aria-label={`Digit ${index + 1}`}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              onPaste={(event) => handlePaste(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className="h-12 w-9 rounded-lg border border-hairline bg-white text-center text-xl font-semibold text-navy outline-none transition-colors focus:border-emerald focus:ring-2 focus:ring-emerald/20 sm:h-14 sm:w-12"
            />
          ))}
        </div>
      </fieldset>
      {verifying && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-navy-light" role="status">
          <SpinnerIcon className="h-4 w-4 text-emerald" /> Verifying your code…
        </div>
      )}
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || verifying || secondsLeft > 0}
        className="mt-6 w-full rounded-lg border border-hairline bg-white py-2.5 text-sm font-medium text-ink transition-colors hover:bg-navy-50 disabled:opacity-60"
      >
        {resending ? "Sending…" : secondsLeft > 0 ? `Resend available in ${secondsLeft}s` : "Resend code"}
      </button>
      {onBack && (
        <button type="button" onClick={onBack} className="mt-4 w-full text-sm text-navy-light hover:text-navy hover:underline">
          Use a different email
        </button>
      )}
      {onGoogle && (
        <div className="mt-7 border-t border-hairline pt-6">
          <div className="flex items-center justify-center gap-3 text-xs text-navy-light" aria-hidden="true">
            <span className="h-px flex-1 bg-hairline" />
            <span>OR</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || verifying}
            aria-busy={googleLoading}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-hairline bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-navy-50 disabled:opacity-60"
          >
            {googleLoading ? <SpinnerIcon className="h-4 w-4" /> : <GoogleIcon />}
            {googleLoading ? "Redirecting to Google…" : "Continue with Google instead"}
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-navy-light">
            Can&apos;t receive your verification code? Continue with Google instead. Use the Google
            account that matches the email above; a different email starts a separate account.
          </p>
        </div>
      )}
      <p className="mt-8 text-center text-sm text-navy-light">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-navy hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
      <path fill="#34A853" d="M12 21.55c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.55Z" />
      <path fill="#FBBC05" d="M6.53 13.63A5.86 5.86 0 0 1 6.22 12c0-.57.11-1.12.31-1.63V7.84H3.28A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.16l3.25-2.53Z" />
      <path fill="#EA4335" d="M12 6.34c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.42 14.63 2.45 12 2.45a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 8.06 9.46 6.34 12 6.34Z" />
    </svg>
  );
}
