"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";
import { validatePasswordStrength } from "@/lib/auth/password";
import { RECOVERY_REDIRECT_FLAG } from "@/components/AuthRescue";

// app/reset-password/update/page.tsx
// Step 2 of the password reset flow: set the new password.
//
// Accepts the recovery session from ANY of three arrival paths, so the
// flow cannot strand a student again:
//   1. Direct: the email link's redirectTo was honored and the PKCE code
//      is in THIS page's URL -- creating the client auto-exchanges it and
//      fires PASSWORD_RECOVERY here.
//   2. Rescued: AuthRescue caught the tokens on the root (Supabase fell
//      back to the Site URL), exchanged them there, and handed the
//      recovery over via sessionStorage (RECOVERY_REDIRECT_FLAG).
//   3. Event: PASSWORD_RECOVERY fires on this client for any other reason.
// If none of these happens within a few seconds, we show an explicit
// "link could not be verified" state with a path to request a new one,
// instead of an infinite spinner.
type Stage = "verifying" | "form" | "invalid" | "done";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [stage, setStage] = useState<Stage>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const validRef = useRef(false);

  useEffect(() => {
    function accept() {
      if (validRef.current) return;
      validRef.current = true;
      setStage("form");
    }
    try {
      if (sessionStorage.getItem(RECOVERY_REDIRECT_FLAG)) {
        sessionStorage.removeItem(RECOVERY_REDIRECT_FLAG);
        accept();
      }
    } catch {
      // storage blocked -- the event path below still covers us
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") accept();
    });
    const t = setTimeout(() => {
      if (!validRef.current) setStage("invalid");
    }, 5000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const issues = validatePasswordStrength(password);
    if (issues.length > 0) {
      setError("Password needs " + issues.join(", ") + ".");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    try {
      sessionStorage.removeItem(RECOVERY_REDIRECT_FLAG);
    } catch {
      // ignore
    }
    setStage("done");
  }

  if (stage === "verifying") {
    return (
      <AuthShell heading="Verifying your link" sub="One moment while we check your reset link.">
        <p className="text-sm text-navy-light text-center">If this takes more than a few seconds, the link may have expired.</p>
      </AuthShell>
    );
  }

  if (stage === "invalid") {
    return (
      <AuthShell heading="Link not valid" sub="That reset link could not be verified.">
        <div className="rounded-xl border border-hairline bg-navy-50 p-5 mb-6">
          <p className="text-sm text-ink">
            Reset links expire and can only be used once. Request a fresh one and try again from the
            new email.
          </p>
        </div>
        <Link
          href="/reset-password"
          className="block w-full rounded-lg bg-navy text-white font-medium py-3 text-center hover:bg-navy-light transition-colors"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (stage === "done") {
    return (
      <AuthShell heading="Password updated" sub="You're all set.">
        <div className="rounded-xl border border-hairline bg-emerald-light p-5 mb-6">
          <p className="text-sm text-ink">Your password has been changed. You can log in with it now.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-lg bg-navy text-white font-medium py-3 hover:bg-navy-light transition-colors"
        >
          Go to my dashboard
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Set a new password" sub="Choose something you haven't used before.">
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="New password"
          error={error ?? undefined}
          hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
        >
          <input
            className={inputClass}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
          />
        </FormField>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {saving ? "Updating\u2026" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
