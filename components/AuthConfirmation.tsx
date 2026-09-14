"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  email: string;
  onResend: () => Promise<string | null>;
  heading?: string;
  sub?: string;
};

export function AuthConfirmation({
  email,
  onResend,
  heading = "Check your email",
  sub = "One more step before you can sign in.",
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  async function handleResend() {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setStatus(null);
    const error = await onResend();
    setResending(false);
    if (error) {
      setStatus(error);
      return;
    }
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    setStatus("A new confirmation link is on its way.");
  }

  return (
    <AuthShell heading={heading} sub={sub}>
      <div className="rounded-xl border border-hairline bg-navy-50 p-5 mb-6" aria-live="polite">
        <p className="text-sm text-ink">
          We sent a confirmation link to <span className="font-medium break-all">{email}</span>.
          Open it to activate your account, then return here to log in.
        </p>
      </div>
      {status && (
        <p className={status.startsWith("A new") ? "text-sm text-emerald mb-4" : "text-sm text-rose mb-4"} role="alert">
          {status}
        </p>
      )}
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || secondsLeft > 0}
        className="w-full rounded-lg border border-hairline bg-white py-2.5 text-sm font-medium text-ink hover:bg-navy-50 transition-colors disabled:opacity-60"
      >
        {resending
          ? "Sending…"
          : secondsLeft > 0
            ? `Resend available in ${secondsLeft}s`
            : "Resend confirmation email"}
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
