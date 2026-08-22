export type AcademicLevel = "undergrad" | "postgrad";

export type ProfileForm = {
  full_name: string;
  nationality: string;
  gender: string;
  academic_level: AcademicLevel | "";
  discipline: string;
  gpa: string;
  financial_need: boolean;
  career_goals: string;
};

export const EMPTY_PROFILE_FORM: ProfileForm = {
  full_name: "",
  nationality: "",
  gender: "",
  academic_level: "",
  discipline: "",
  gpa: "",
  financial_need: false,
  career_goals: "",
};

export const DISCIPLINE_OPTIONS = [
  "STEM",
  "Engineering",
  "Business",
  "Law",
  "Medicine & Health Sciences",
  "Arts & Humanities",
  "Social Sciences",
  "Education",
  "Agriculture",
  "Other",
];

export const NATIONALITY_SUGGESTIONS = [
  "Nigerian",
  "Ghanaian",
  "Kenyan",
  "South African",
  "Egyptian",
  "British",
  "American",
  "Canadian",
];

export const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say"];

// Mirrors compute_profile_completeness() in supabase/migrations/0001_init.sql
// so the UI can show an optimistic score before the row round-trips.
export function estimateCompleteness(form: ProfileForm): number {
  let score = 0;
  if (form.full_name.trim()) score += 15;
  if (form.academic_level) score += 20;
  if (form.discipline.trim()) score += 20;
  if (form.gpa.trim()) score += 15;
  if (form.nationality.trim()) score += 15;
  if (form.career_goals.trim()) score += 15;
  return score;
}
