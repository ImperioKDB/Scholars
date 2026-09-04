"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";

// app/reset-password/update/page.tsx
// GET /reset-password/update
//
// Step 2 of the password reset flow. The recovery link's access token
// lives in the URL hash fragment -- the Supabase JS client parses it
// automatically on load and fires a PASSWORD_RECOVERY auth event once a
// session is established from it. That event (not the URL shape itself)
// is the reliable signal that this form should unlock, since a stale or
// already-used link won't produce a session at all.

export default function ResetPasswordUpdatePage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Covers the case where the PASSWORD_RECOVERY event already fired
    // before this listener attached (e.g. fast redirect).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Couldn't update your password. The link may have expired -- request a new one.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <AuthShell heading="Password updated" sub="Taking you to log in.">
        <p className="text-sm text-ink">You&apos;re all set.</p>
      </AuthShell>
    );
  }

  if (!ready) {
    return (
      <AuthShell heading="Verifying your link" sub="This only takes a second.">
        <p className="text-sm text-navy-light">
          If nothing happens, the link may have expired -- request a new one from the{" "}
          <a href="/reset-password" className="text-navy font-medium hover:underline">
            reset password page
          </a>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Set a new password" sub="Choose something you haven't used here before.">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="New password">
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

        <FormField label="Confirm password" error={error ?? undefined}>
          <input
            className={inputClass}
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            autoComplete="new-password"
          />
        </FormField>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {loading ? "Updating\u2026" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
