"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { StepIndicator } from "@/components/StepIndicator";
import { FormField, inputClass, selectClass, textareaClass } from "@/components/FormField";
import {
  DISCIPLINE_OPTIONS,
  GENDER_OPTIONS,
  NATIONALITY_SUGGESTIONS,
  EMPTY_PROFILE_FORM,
  type ProfileForm,
} from "@/lib/profile";

const STEPS = ["Personal", "Academic", "Goals & Preferences"];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExistingProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/profile");

      if (res.status === 401) {
        router.replace("/login");
        return;
      }

      if (res.ok) {
        const { profile } = await res.json();
        setForm({
          full_name: profile.full_name ?? "",
          nationality: profile.nationality ?? "",
          gender: profile.gender ?? "",
          academic_level: (profile.academic_level as ProfileForm["academic_level"]) ?? "",
          discipline: profile.discipline ?? "",
          gpa: profile.gpa != null ? String(profile.gpa) : "",
          financial_need: profile.financial_need ?? false,
          career_goals: profile.career_goals ?? "",
        });
      }
      // 404 just means no profile row saved yet — keep the empty form, not an error.
      setLoading(false);
    }
    loadExistingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 0 && !form.full_name.trim()) return "We need your name to personalize matches.";
    if (step === 1 && !form.academic_level) return "Select your current academic level.";
    return null;
  }

  function goNext() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinish() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.full_name.trim(),
        nationality: form.nationality.trim() || null,
        gender: form.gender || null,
        academic_level: form.academic_level || null,
        discipline: form.discipline || null,
        gpa: form.gpa ? Number(form.gpa) : null,
        financial_need: form.financial_need,
        career_goals: form.career_goals.trim() || null,
      }),
    });

    setSaving(false);

    if (res.status === 401) {
      router.replace("/login");
      return;
    }

    if (!res.ok) {
      setError("Couldn't save your profile. Please try again.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSkip() {
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment">
        <p className="text-sm text-navy-light font-mono">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5 flex items-center justify-between">
          <Logo className="text-navy" />
          <button
            onClick={handleSkip}
            className="text-sm text-navy-light hover:text-navy"
          >
            Skip for now
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <StepIndicator steps={STEPS} current={step} />

        <div className="bg-white rounded-2xl border border-hairline shadow-card p-8">
          <h1 className="font-display text-2xl font-semibold text-navy mb-1">
            {step === 0 && "Personal information"}
            {step === 1 && "Academic background"}
            {step === 2 && "Goals & preferences"}
          </h1>
          <p className="text-sm text-navy-light mb-8">
            {step === 0 && "Tell us who you are so we can personalize your matches."}
            {step === 1 && "This drives most of your eligibility scoring — take your time here."}
            {step === 2 && "Helps us prioritize need-based awards and tailor recommendations."}
          </p>

          {step === 0 && (
            <>
              <FormField label="Full name">
                <input
                  className={inputClass}
                  type="text"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  placeholder="Enter your full name"
                />
              </FormField>

              <FormField label="Nationality" hint="Used to check citizenship-based eligibility rules.">
                <input
                  className={inputClass}
                  list="nationality-suggestions"
                  value={form.nationality}
                  onChange={(e) => update("nationality", e.target.value)}
                  placeholder="e.g. Nigerian"
                />
                <datalist id="nationality-suggestions">
                  {NATIONALITY_SUGGESTIONS.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </FormField>

              <FormField label="Gender (optional)">
                <select
                  className={selectClass}
                  value={form.gender}
                  onChange={(e) => update("gender", e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </FormField>
            </>
          )}

          {step === 1 && (
            <>
              <FormField label="Academic level">
                <div className="grid grid-cols-2 gap-3">
                  {(["undergrad", "postgrad"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => update("academic_level", level)}
                      className={[
                        "rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors",
                        form.academic_level === level
                          ? "border-navy bg-navy-50 text-navy"
                          : "border-hairline text-navy-light hover:border-navy/40",
                      ].join(" ")}
                    >
                      {level === "undergrad" ? "Undergraduate" : "Postgraduate"}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Field of study / discipline">
                <select
                  className={selectClass}
                  value={form.discipline}
                  onChange={(e) => update("discipline", e.target.value)}
                >
                  <option value="">Select a field</option>
                  {DISCIPLINE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="GPA / CGPA (optional)" hint="Enter it on your institution's own scale, e.g. 3.72.">
                <input
                  className={inputClass}
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  value={form.gpa}
                  onChange={(e) => update("gpa", e.target.value)}
                  placeholder="3.72"
                />
              </FormField>
            </>
          )}

          {step === 2 && (
            <>
              <FormField label="Do you have significant financial need?">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => update("financial_need", opt.value)}
                      className={[
                        "rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                        form.financial_need === opt.value
                          ? "border-navy bg-navy-50 text-navy"
                          : "border-hairline text-navy-light hover:border-navy/40",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Career goals (optional)" hint="A sentence or two — helps us surface relevant awards.">
                <textarea
                  className={textareaClass}
                  value={form.career_goals}
                  onChange={(e) => update("career_goals", e.target.value)}
                  placeholder="e.g. Become a research scientist focused on renewable energy."
                />
              </FormField>
            </>
          )}

          {error && <p className="text-sm text-rose mb-4">{error}</p>}

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-hairline">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="text-sm font-medium text-navy-light hover:text-navy disabled:opacity-0 disabled:pointer-events-none"
            >
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Finish & see matches"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
