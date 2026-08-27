"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { StepIndicator } from "@/components/StepIndicator";
import { FormField, inputClass, selectClass, textareaClass } from "@/components/FormField";
import { Combobox } from "@/components/Combobox";
import { WaecResultsEditor, type WaecRow } from "@/components/WaecResultsEditor";
import { Skeleton } from "@/components/Skeleton";
import {
  DISCIPLINE_OPTIONS,
  GENDER_OPTIONS,
  NATIONALITY_SUGGESTIONS,
  NIGERIAN_STATES,
  YEAR_OF_STUDY_OPTIONS,
  EMPTY_PROFILE_FORM,
  type ProfileForm,
} from "@/lib/profile";
import { INSTITUTION_OPTIONS, institutionTypeFor } from "@/lib/data/institutions";

const STEPS = ["Personal", "Academic", "Eligibility", "Documents"];

const DISCIPLINE_COMBO_OPTIONS = DISCIPLINE_OPTIONS.map((d) => ({ value: d, label: d }));

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [waecRows, setWaecRows] = useState<WaecRow[]>([]);
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

      const [profileRes, waecRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/profile/waec"),
      ]);

      if (profileRes.status === 401) {
        router.replace("/login");
        return;
      }

      if (profileRes.ok) {
        const { profile } = await profileRes.json();
        setForm({
          full_name: profile.full_name ?? "",
          nationality: profile.nationality ?? "Nigerian",
          gender: profile.gender ?? "",
          discipline: profile.discipline ?? "",
          gpa: profile.gpa != null ? String(profile.gpa) : "",
          financial_need: profile.financial_need ?? false,
          career_goals: profile.career_goals ?? "",
          date_of_birth: profile.date_of_birth ?? "",
          state_of_origin: profile.state_of_origin ?? "",
          lga_of_origin: profile.lga_of_origin ?? "",
          year_of_study: profile.year_of_study != null ? String(profile.year_of_study) : "",
          institution_name: profile.institution_name ?? "",
          institution_type: profile.institution_type ?? "",
          jamb_score: profile.jamb_score != null ? String(profile.jamb_score) : "",
          waec_credit_count: profile.waec_credit_count != null ? String(profile.waec_credit_count) : "",
          has_english_maths_credit: profile.has_english_maths_credit ?? false,
          disability_status: profile.disability_status ?? false,
          has_valid_id: profile.has_valid_id ?? false,
          has_transcript: profile.has_transcript ?? false,
          has_recommendation_letter: profile.has_recommendation_letter ?? false,
          has_personal_statement: profile.has_personal_statement ?? false,
          has_lga_certificate: profile.has_lga_certificate ?? false,
        });
      }
      // 404 just means no profile row saved yet -- keep the empty form, not an error.

      if (waecRes.ok) {
        const { results } = await waecRes.json();
        setWaecRows(
          (results ?? []).map((r: { subject: string; grade: string }) => ({
            key: crypto.randomUUID(),
            subject: r.subject,
            grade: r.grade,
          }))
        );
      }

      setLoading(false);
    }
    loadExistingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Selecting an institution from the Combobox sets both the name and the
  // type in one step -- there's no separate "institution type" question
  // anymore, since the type comes from the matched institution record.
  function selectInstitution(name: string) {
    const type = institutionTypeFor(name);
    setForm((f) => ({
      ...f,
      institution_name: name,
      institution_type: (type ?? "") as ProfileForm["institution_type"],
    }));
  }

  function validateStep(): string | null {
    if (step === 0 && !form.full_name.trim()) return "We need your name to personalize matches.";
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
        discipline: form.discipline || null,
        gpa: form.gpa ? Number(form.gpa) : null,
        financial_need: form.financial_need,
        career_goals: form.career_goals.trim() || null,
        date_of_birth: form.date_of_birth || null,
        state_of_origin: form.state_of_origin || null,
        lga_of_origin: form.lga_of_origin.trim() || null,
        year_of_study: form.year_of_study ? Number(form.year_of_study) : null,
        institution_name: form.institution_name.trim() || null,
        institution_type: form.institution_type || null,
        jamb_score: form.jamb_score ? Number(form.jamb_score) : null,
        // waec_credit_count / has_english_maths_credit are intentionally
        // omitted here -- they're derived automatically by the
        // sync_waec_summary_fields() Postgres trigger from whatever gets
        // saved to /api/profile/waec just below, so sending a manually
        // tracked value from this form would only be overwritten a moment
        // later anyway.
        disability_status: form.disability_status,
        has_valid_id: form.has_valid_id,
        has_transcript: form.has_transcript,
        has_recommendation_letter: form.has_recommendation_letter,
        has_personal_statement: form.has_personal_statement,
        has_lga_certificate: form.has_lga_certificate,
      }),
    });

    if (res.status === 401) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    if (!res.ok) {
      setSaving(false);
      setError("Couldn't save your profile. Please try again.");
      return;
    }

    const validWaecRows = waecRows.filter((r) => r.subject && r.grade);
    const waecRes = await fetch("/api/profile/waec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: validWaecRows.map((r) => ({ subject: r.subject, grade: r.grade })),
      }),
    });

    setSaving(false);

    if (!waecRes.ok) {
      setError("Your profile saved, but your WAEC results didn't. You can retry from this page.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSkip() {
    router.push("/dashboard");
  }

  if (loading) {
    // Mirrors the real layout below (header, StepIndicator, card with
    // heading/subtext/fields) instead of a plain "Loading your profile..."
    // line, so the page doesn't visibly re-lay-out once data arrives.
    return (
      <div className="min-h-screen bg-parchment">
        <header className="border-b border-hairline bg-white">
          <div className="mx-auto max-w-2xl px-6 py-5 flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="flex items-center w-full mb-10">
            {STEPS.map((_, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <Skeleton className="w-8 h-8 rounded-seal shrink-0" />
                {i < STEPS.length - 1 && <div className="h-px flex-1 mx-3 bg-hairline" />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-hairline shadow-card p-8">
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-8" />

            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3.5 w-28 mb-1.5" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-hairline">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-10 w-28 rounded-seal" />
            </div>
          </div>
        </main>
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
            {step === 2 && "Eligibility details"}
            {step === 3 && "Documents & goals"}
          </h1>
          <p className="text-sm text-navy-light mb-8">
            {step === 0 && "Tell us who you are so we can personalize your matches."}
            {step === 1 && "Your institution and field of study -- this drives most of your matches."}
            {step === 2 && "JAMB and WAEC results -- most Nigerian scholarships gate on these directly."}
            {step === 3 && "Tell us which documents you already have ready to submit."}
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

              <FormField label="Date of birth" hint="Used to check age-based eligibility rules.">
                <input
                  className={inputClass}
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => update("date_of_birth", e.target.value)}
                />
              </FormField>

              <FormField label="Nationality">
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

              <FormField label="State of origin" hint="Many state government scholarships require an exact match.">
                <select
                  className={selectClass}
                  value={form.state_of_origin}
                  onChange={(e) => update("state_of_origin", e.target.value)}
                >
                  <option value="">Select a state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="LGA of origin">
                <input
                  className={inputClass}
                  type="text"
                  value={form.lga_of_origin}
                  onChange={(e) => update("lga_of_origin", e.target.value)}
                  placeholder="e.g. Ikeja"
                />
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
              <FormField label="Field of study / discipline" hint="Search and select -- typing alone won't set it.">
                <Combobox
                  options={DISCIPLINE_COMBO_OPTIONS}
                  value={form.discipline}
                  onChange={(value) => update("discipline", value)}
                  placeholder="Search a course, e.g. Computer Science"
                />
              </FormField>

              <FormField label="Institution" hint="Search and select -- this sets your institution type automatically, so there's nothing else to fill in here.">
                <Combobox
                  options={INSTITUTION_OPTIONS}
                  value={form.institution_name}
                  onChange={selectInstitution}
                  placeholder="Search your university, polytechnic, or college"
                />
              </FormField>

              <FormField label="Year of study" hint="Some scholarships only cover early or final years.">
                <select
                  className={selectClass}
                  value={form.year_of_study}
                  onChange={(e) => update("year_of_study", e.target.value)}
                >
                  <option value="">Select</option>
                  {YEAR_OF_STUDY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
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
              <FormField label="JAMB / UTME score (optional)">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  max="400"
                  value={form.jamb_score}
                  onChange={(e) => update("jamb_score", e.target.value)}
                  placeholder="e.g. 280"
                />
              </FormField>

              <FormField
                label="WAEC / NECO / NABTEB results"
                hint="Add each subject and the grade you got -- your credit count and English/Maths status are worked out from this automatically."
              >
                <WaecResultsEditor rows={waecRows} onChange={setWaecRows} />
              </FormField>

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

              <FormField label="Do you live with a disability?">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => update("disability_status", opt.value)}
                      className={[
                        "rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                        form.disability_status === opt.value
                          ? "border-navy bg-navy-50 text-navy"
                          : "border-hairline text-navy-light hover:border-navy/40",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm font-medium text-ink mb-3">Documents ready to submit</p>
              <div className="space-y-3 mb-6">
                {[
                  { key: "has_valid_id" as const, label: "Valid means of identification (NIN, voter's card, passport)" },
                  { key: "has_transcript" as const, label: "Academic transcript / statement of results" },
                  { key: "has_recommendation_letter" as const, label: "Recommendation letter" },
                  { key: "has_personal_statement" as const, label: "Personal statement / letter of motivation" },
                  { key: "has_lga_certificate" as const, label: "LGA / state of origin certificate" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-3 rounded-lg border border-hairline px-4 py-3 cursor-pointer hover:border-navy/40"
                  >
                    <input
                      type="checkbox"
                      checked={form[item.key]}
                      onChange={(e) => update(item.key, e.target.checked)}
                      className="rounded border-hairline"
                    />
                    <span className="text-sm text-ink">{item.label}</span>
                  </label>
                ))}
              </div>

              <FormField label="Career goals (optional)" hint="A sentence or two -- helps us surface relevant awards.">
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
              disabled={step === 0 || saving}
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
                className="inline-flex items-center gap-2 rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Finish & see matches"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
