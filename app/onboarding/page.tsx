// app/onboarding/page.tsx
// VALUE-FIRST REWORK (Phase 1): the old order (Personal, Academic,
// Eligibility, Documents) made a student fill four screens of identity
// paperwork before seeing a single match, and 85% of signups never
// finished. The order is now Core, Personal, Academic, Documents:
//   - Step 0 (Core) collects exactly the fields the matching engine gates
//     on: name, course, institution (+type), year of study.
//   - Step 0 ends with a second exit, "See my provisional matches", which
//     saves the partial profile and routes straight to the dashboard. The
//     dashboard already computes real matches from a partial profile and
//     already renders GapNudgeBanner nudges for every missing field, so
//     progressive profiling is the completion engine from that point on.
//   - "Skip for now" remains on steps 1-3 with its existing lossless
//     behavior (save whatever is filled, go to dashboard). On step 0 the
//     provisional button is that exit, so no screen shows two CTAs with
//     the same intent.
// Draft persistence key bumped to v2: the step order changed, so a v1
// draft's saved step index would land people on the wrong screen.
"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { StepIndicator } from "@/components/StepIndicator";
import { FormField, inputClass, selectClass, textareaClass } from "@/components/FormField";
import { Combobox } from "@/components/Combobox";
import { WaecResultsEditor, type WaecRow } from "@/components/WaecResultsEditor";
import { Skeleton } from "@/components/Skeleton";
import { getLGAsForState } from "@/lib/data/lgas";
import {
  DISCIPLINE_OPTIONS,
  GENDER_OPTIONS,
  NATIONALITY_SUGGESTIONS,
  NIGERIAN_STATES,
  YEAR_OF_STUDY_OPTIONS,
  INSTITUTION_TYPE_OPTIONS,
  EMPTY_PROFILE_FORM,
  type ProfileForm,
} from "@/lib/profile";
import { INSTITUTION_OPTIONS, institutionTypeFor } from "@/lib/data/institutions";
const STEPS = ["Core", "Personal", "Academic", "Documents"];
const DISCIPLINE_COMBO_OPTIONS = DISCIPLINE_OPTIONS.map((d) => ({ value: d, label: d }));
const ONBOARDING_DRAFT_KEY = "scholars.onboarding.draft.v2";
type OnboardingDraft = {
  form: ProfileForm;
  waecRows: WaecRow[];
  step: number;
  manualInstitution: boolean;
  manualDiscipline: boolean;
};
function readDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    return {
      form: { ...EMPTY_PROFILE_FORM, ...parsed.form },
      waecRows: Array.isArray(parsed.waecRows) ? parsed.waecRows : [],
      step: typeof parsed.step === "number" ? parsed.step : 0,
      manualInstitution: Boolean(parsed.manualInstitution),
      manualDiscipline: Boolean(parsed.manualDiscipline),
    };
  } catch {
    return null;
  }
}
function writeDraft(draft: OnboardingDraft) {
  try {
    window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage blocked -- persistence is best-effort
  }
}
function clearDraft() {
  try {
    window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // ignore
  }
}
// Single payload builder so "Finish", "Skip for now" and the provisional
// exit send the exact same shape. Empty strings become null so a partial
// profile never stores blanks.
function profilePayload(form: ProfileForm) {
  return {
    full_name: form.full_name.trim(),
    nationality: form.nationality.trim() || null,
    gender: form.gender || null,
    discipline: form.discipline.trim() || null,
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
    waec_credit_count: form.waec_credit_count ? Number(form.waec_credit_count) : null,
    disability_status: form.disability_status,
    has_valid_id: form.has_valid_id,
    has_transcript: form.has_transcript,
    has_recommendation_letter: form.has_recommendation_letter,
    has_personal_statement: form.has_personal_statement,
    has_lga_certificate: form.has_lga_certificate,
  };
}
function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [waecRows, setWaecRows] = useState<WaecRow[]>([]);
  const [manualInstitution, setManualInstitution] = useState(false);
  const [manualDiscipline, setManualDiscipline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skipPending, setSkipPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const lgaOptions = useMemo(
    () => getLGAsForState(form.state_of_origin).map((l) => ({ value: l, label: l })),
    [form.state_of_origin]
  );
  const stepParam = Number(searchParams.get("step"));
  const hasStepParam = !Number.isNaN(stepParam) && stepParam >= 0 && stepParam < STEPS.length;
  useEffect(() => {
    if (hasStepParam) setStep(stepParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    async function loadExistingProfile() {
      const { data: { user } } = await supabase.auth.getUser();
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
      let serverForm: ProfileForm = { ...EMPTY_PROFILE_FORM };
      if (profileRes.ok) {
        const { profile } = await profileRes.json();
        serverForm = {
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
        };
      }
      let serverWaecRows: WaecRow[] = [];
      if (waecRes.ok) {
        const { results } = await waecRes.json();
        serverWaecRows = (results ?? []).map((r: { subject: string; grade: string }) => ({
          key: crypto.randomUUID(),
          subject: r.subject,
          grade: r.grade,
        }));
      }
      const draft = readDraft();
      if (draft) {
        setForm({ ...serverForm, ...draft.form });
        setWaecRows(draft.waecRows.length > 0 ? draft.waecRows : serverWaecRows);
        if (!hasStepParam) {
          setStep(Math.min(Math.max(draft.step, 0), STEPS.length - 1));
        }
        setManualInstitution(draft.manualInstitution);
        setManualDiscipline(draft.manualDiscipline);
      } else {
        setForm(serverForm);
        setWaecRows(serverWaecRows);
        if (serverForm.institution_name && !institutionTypeFor(serverForm.institution_name)) {
          setManualInstitution(true);
        }
        if (serverForm.discipline && !DISCIPLINE_OPTIONS.includes(serverForm.discipline)) {
          setManualDiscipline(true);
        }
      }
      setLoading(false);
    }
    loadExistingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (loading) return;
    writeDraft({ form, waecRows, step, manualInstitution, manualDiscipline });
  }, [form, waecRows, step, manualInstitution, manualDiscipline, loading]);
  useEffect(() => {
    if (!dirty || saving) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saving]);
  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }
  function updateStateOfOrigin(value: string) {
    setForm((f) => {
      const lgas = getLGAsForState(value);
      const keepLga =
        value === f.state_of_origin ? f.lga_of_origin : lgas.includes(f.lga_of_origin) ? f.lga_of_origin : "";
      return { ...f, state_of_origin: value, lga_of_origin: keepLga };
    });
    setDirty(true);
  }
  function updateWaecRows(rows: WaecRow[]) {
    setWaecRows(rows);
    setDirty(true);
  }
  function selectInstitution(name: string) {
    const type = institutionTypeFor(name);
    setForm((f) => ({
      ...f,
      institution_name: name,
      institution_type: (type ?? "") as ProfileForm["institution_type"],
    }));
    setDirty(true);
  }
  function toggleManualInstitution() {
    setManualInstitution((m) => !m);
    setForm((f) => ({ ...f, institution_name: "", institution_type: "" }));
    setDirty(true);
  }
  function toggleManualDiscipline() {
    setManualDiscipline((m) => !m);
    setForm((f) => ({ ...f, discipline: "" }));
    setDirty(true);
  }
  function validateStep(): string | null {
    if (step === 0) {
      if (!form.full_name.trim()) return "We need your name to personalize matches.";
      if (!form.discipline.trim()) return "Pick your course so we can check discipline rules.";
      if (!form.institution_name.trim()) return "Pick your institution so we can check institution rules.";
      if (manualInstitution && form.institution_name.trim() && !form.institution_type) {
        return "Pick your institution type so your matches stay accurate.";
      }
      if (!form.year_of_study) return "Pick your year of study; some awards only cover certain years.";
      return null;
    }
    return null;
  }
  const coreValid = step === 0 && validateStep() === null;
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
  async function saveProfileAndGoDashboard() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profilePayload(form)),
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
    setDirty(false);
    clearDraft();
    router.push("/dashboard");
    router.refresh();
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
      body: JSON.stringify(profilePayload(form)),
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
      body: JSON.stringify({ results: validWaecRows.map((r) => ({ subject: r.subject, grade: r.grade })) }),
    });
    setSaving(false);
    if (!waecRes.ok) {
      setError("Your profile saved, but your WAEC results didn't. You can retry from this page.");
      return;
    }
    setDirty(false);
    clearDraft();
    router.push("/dashboard");
    router.refresh();
  }
  // MOMENTUM FIX (user feedback): skipping is no longer lossy. We save
  // whatever the student has filled so far, then send them straight to the
  // dashboard so they still see first matches and can finish later from
  // Edit profile. A skip that discards everything is what made onboarding
  // feel like a toll booth.
  async function handleSkip() {
    setSkipPending(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload(form)),
      });
      clearDraft();
    } catch {
      // Skip must always work even if the save fails -- navigate anyway.
    }
    router.push("/dashboard");
    router.refresh();
  }
  if (loading) {
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
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <StepIndicator steps={STEPS} current={step} />
        <div className="bg-white rounded-2xl border border-hairline shadow-card p-8">
          <h1 className="font-display text-2xl font-semibold text-navy mb-1">
            {step === 0 && "Core details"}
            {step === 1 && "Personal information"}
            {step === 2 && "Academic results"}
            {step === 3 && "Documents & goals"}
          </h1>
          <p className="text-sm text-navy-light mb-2">
            {step === 0 && "Name, school, course and level. That is all we need for your first real matches."}
            {step === 1 && "State, LGA and age drive many Nigerian awards. Each one you add can unlock matches."}
            {step === 2 && "JAMB and WAEC results -- most Nigerian scholarships gate on these directly."}
            {step === 3 && "Tell us which documents you already have ready to submit."}
          </p>
          <p className="text-xs text-navy-light mb-8">
            {step === 0
              ? "Everything after this step sharpens your matches. Your answers save automatically on this device."
              : "Only what you fill is stored. Your answers save automatically on this device."}
          </p>
          {step === 0 && (
            <>
              <FormField label="Full name">
                <input className={inputClass} type="text" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Enter your full name" />
              </FormField>
              <FormField label="Field of study / discipline" hint="Search and select -- typing the exact course name works too.">
                {manualDiscipline ? (
                  <input className={inputClass} type="text" value={form.discipline} onChange={(e) => update("discipline", e.target.value)} placeholder="e.g. Mechatronics Engineering" />
                ) : (
                  <Combobox options={DISCIPLINE_COMBO_OPTIONS} value={form.discipline} onChange={(value) => update("discipline", value)} placeholder="Search a course, e.g. Computer Science" />
                )}
              </FormField>
              <button type="button" onClick={toggleManualDiscipline} className="-mt-2 mb-4 text-xs font-medium text-navy hover:underline">
                {manualDiscipline ? "Search the list instead" : "Can't find your course? Enter it manually"}
              </button>
              <FormField label="Institution" hint={manualInstitution ? "Type your school's official name and pick its type." : "Search and select -- this sets your institution type automatically."}>
                {manualInstitution ? (
                  <div className="space-y-2">
                    <input className={inputClass} type="text" value={form.institution_name} onChange={(e) => update("institution_name", e.target.value)} placeholder="e.g. Federal University of Technology, Akure" />
                    <select className={selectClass} value={form.institution_type} onChange={(e) => update("institution_type", e.target.value as ProfileForm["institution_type"])}>
                      <option value="">Select institution type</option>
                      {INSTITUTION_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                ) : (
                  <Combobox options={INSTITUTION_OPTIONS} value={form.institution_name} onChange={selectInstitution} placeholder="Search your university, polytechnic, or college" />
                )}
              </FormField>
              <button type="button" onClick={toggleManualInstitution} className="-mt-2 mb-4 text-xs font-medium text-navy hover:underline">
                {manualInstitution ? "Search the list instead" : "Can't find your school? Enter it manually"}
              </button>
              <FormField label="Year of study" hint="Some scholarships only cover early or final years.">
                <select className={selectClass} value={form.year_of_study} onChange={(e) => update("year_of_study", e.target.value)}>
                  <option value="">Select</option>
                  {YEAR_OF_STUDY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </FormField>
            </>
          )}
          {step === 1 && (
            <>
              <FormField label="Date of birth" hint="Used to check age-based eligibility rules.">
                <input className={inputClass} type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
              </FormField>
              <FormField label="Nationality">
                <input className={inputClass} list="nationality-suggestions" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} placeholder="e.g. Nigerian" />
                <datalist id="nationality-suggestions">
                  {NATIONALITY_SUGGESTIONS.map((n) => (<option key={n} value={n} />))}
                </datalist>
              </FormField>
              <FormField label="State of origin" hint="Many state government scholarships require an exact match.">
                <select className={selectClass} value={form.state_of_origin} onChange={(e) => updateStateOfOrigin(e.target.value)}>
                  <option value="">Select a state</option>
                  {NIGERIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </FormField>
              <FormField
                label="LGA of origin"
                hint={form.state_of_origin ? undefined : "Select your state of origin first."}
              >
                {form.state_of_origin ? (
                  <Combobox
                    options={lgaOptions}
                    value={form.lga_of_origin}
                    onChange={(value) => update("lga_of_origin", value)}
                    placeholder={`Search ${form.state_of_origin} LGAs`}
                    emptyMessage={`No LGA matches in ${form.state_of_origin}.`}
                  />
                ) : (
                  <input className={inputClass + " opacity-60"} type="text" disabled placeholder="Select your state first" value="" onChange={() => {}} />
                )}
              </FormField>
              <FormField label="Gender (optional)">
                <select className={selectClass} value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  {GENDER_OPTIONS.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </FormField>
            </>
          )}
          {step === 2 && (
            <>
              <FormField label="GPA / CGPA (optional)" hint="Enter it on your institution's own scale, e.g. 3.72.">
                <input className={inputClass} type="number" step="0.01" min="0" max="5" value={form.gpa} onChange={(e) => update("gpa", e.target.value)} placeholder="3.72" />
              </FormField>
              <FormField label="JAMB / UTME score (optional)">
                <input className={inputClass} type="number" min="0" max="400" value={form.jamb_score} onChange={(e) => update("jamb_score", e.target.value)} placeholder="e.g. 280" />
              </FormField>
              <FormField label="WAEC / NECO / NABTEB results" hint="Add each subject and the grade you got -- credit count and English/Maths status are derived automatically.">
                <WaecResultsEditor rows={waecRows} onChange={updateWaecRows} />
              </FormField>
              <FormField label="Do you have significant financial need?">
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: "Yes", value: true }, { label: "No", value: false }].map((opt) => (
                    <button key={opt.label} type="button" onClick={() => update("financial_need", opt.value)}
                      className={["rounded-lg border px-4 py-3 text-sm font-medium transition-colors", form.financial_need === opt.value ? "border-navy bg-navy-50 text-navy" : "border-hairline text-navy-light hover:border-navy/40"].join(" ")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Do you live with a disability?">
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: "Yes", value: true }, { label: "No", value: false }].map((opt) => (
                    <button key={opt.label} type="button" onClick={() => update("disability_status", opt.value)}
                      className={["rounded-lg border px-4 py-3 text-sm font-medium transition-colors", form.disability_status === opt.value ? "border-navy bg-navy-50 text-navy" : "border-hairline text-navy-light hover:border-navy/40"].join(" ")}>
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
                  <label key={item.key} className="flex items-center gap-3 rounded-lg border border-hairline px-4 py-3 cursor-pointer hover:border-navy/40">
                    <input type="checkbox" checked={form[item.key]} onChange={(e) => update(item.key, e.target.checked)} className="rounded border-hairline" />
                    <span className="text-sm text-ink">{item.label}</span>
                  </label>
                ))}
              </div>
              <FormField label="Career goals (optional)" hint="A sentence or two -- helps us surface relevant awards.">
                <textarea className={textareaClass} value={form.career_goals} onChange={(e) => update("career_goals", e.target.value)} placeholder="e.g. Become a research scientist focused on renewable energy." />
              </FormField>
            </>
          )}
          {error && <p className="text-sm text-rose mb-4">{error}</p>}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-hairline gap-3">
            <button type="button" onClick={goBack} disabled={step === 0 || saving || skipPending}
              className="text-sm font-medium text-navy-light hover:text-navy disabled:opacity-0 disabled:pointer-events-none">
              Back
            </button>
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={handleSkip} disabled={saving || skipPending}
                  className="text-sm font-medium text-navy-light hover:text-navy px-3 py-2 disabled:opacity-60">
                  {skipPending ? "Saving\u2026" : "Skip for now"}
                </button>
              )}
              {step === 0 ? (
                <>
                  <button type="button" onClick={goNext} disabled={saving || skipPending}
                    className="rounded-seal border border-hairline bg-white text-navy text-sm font-medium px-5 py-2.5 hover:bg-navy-50 transition-colors disabled:opacity-60">
                    Continue
                  </button>
                  <button type="button" onClick={saveProfileAndGoDashboard} disabled={!coreValid || saving || skipPending}
                    className="inline-flex items-center gap-2 rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
                    {saving ? "Saving..." : "See my provisional matches"}
                  </button>
                </>
              ) : step < STEPS.length - 1 ? (
                <button type="button" onClick={goNext} disabled={saving || skipPending}
                  className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
                  Continue
                </button>
              ) : (
                <button type="button" onClick={handleFinish} disabled={saving || skipPending}
                  className="inline-flex items-center gap-2 rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60">
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
        </div>
      </main>
    </div>
  );
}
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingForm />
    </Suspense>
  );
}
