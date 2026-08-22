"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { FormField, inputClass } from "@/components/FormField";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push("/onboarding");
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
  }

  return (
    <AuthShell
      heading="Create your account"
      sub="Start discovering scholarships in minutes."
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Full name">
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </FormField>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-navy text-white font-medium py-3 mt-2 hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
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
        Already have an account?{" "}
        <Link href="/login" className="text-navy font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
