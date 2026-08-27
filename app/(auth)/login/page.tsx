"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("That email and password don't match an account.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  return (
    <AuthShell heading="Welcome back" sub="Log in to see your latest matches.">
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

        <FormField label="Password" error={error ?? undefined}>
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
        className="w-full rounded-lg border border-hairline bg-white py-2.5 text-sm font-medium text-ink hover:bg-navy-50 transition-colors"
      >
        Continue with Google
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
