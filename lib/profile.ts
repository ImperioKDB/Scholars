export type InstitutionType =
  | "federal_uni"
  | "state_uni"
  | "private_uni"
  | "polytechnic"
  | "college_of_education";

export type ProfileForm = {
  full_name: string;
  nationality: string;
  gender: string;
  discipline: string;
  gpa: string;
  financial_need: boolean;
  career_goals: string;
  date_of_birth: string;
  state_of_origin: string;
  lga_of_origin: string;
  year_of_study: string;
  institution_name: string;
  institution_type: InstitutionType | "";
  jamb_score: string;
  waec_credit_count: string;
  has_english_maths_credit: boolean;
  disability_status: boolean;
  has_valid_id: boolean;
  has_transcript: boolean;
  has_recommendation_letter: boolean;
  has_personal_statement: boolean;
  has_lga_certificate: boolean;
};

export const EMPTY_PROFILE_FORM: ProfileForm = {
  full_name: "",
  nationality: "Nigerian",
  gender: "",
  discipline: "",
  gpa: "",
  financial_need: false,
  career_goals: "",
  date_of_birth: "",
  state_of_origin: "",
  lga_of_origin: "",
  year_of_study: "",
  institution_name: "",
  institution_type: "",
  jamb_score: "",
  waec_credit_count: "",
  has_english_maths_credit: false,
  disability_status: false,
  has_valid_id: false,
  has_transcript: false,
  has_recommendation_letter: false,
  has_personal_statement: false,
  has_lga_certificate: false,
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

export const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say"];

// Nigerian-undergrad-only platform: nationality is still asked (some
// scholarships are Nigerian-diaspora or dual-citizenship specific), but
// state/LGA of origin is the sharper eligibility signal most local
// scholarship boards actually gate on.
export const NATIONALITY_SUGGESTIONS = ["Nigerian", "Dual citizen (Nigerian)", "Other"];

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export const INSTITUTION_TYPE_OPTIONS: { value: InstitutionType; label: string }[] = [
  { value: "federal_uni", label: "Federal University" },
  { value: "state_uni", label: "State University" },
  { value: "private_uni", label: "Private University" },
  { value: "polytechnic", label: "Polytechnic / Monotechnic" },
  { value: "college_of_education", label: "College of Education" },
];

export const YEAR_OF_STUDY_OPTIONS = [100, 200, 300, 400, 500, 600].map((n) => ({
  value: String(n),
  label: `${n} Level`,
}));

// Mirrors calculate_profile_completeness() in the live Supabase schema
// (migration: 0004_undergrad_focus_richer_eligibility_profile) so the UI can
// show an optimistic score before the row round-trips. 13 weighted fields.
export function estimateCompleteness(form: ProfileForm): number {
  const total = 13;
  const fields = [
    form.full_name.trim(),
    form.discipline.trim(),
    form.gpa.trim(),
    form.nationality.trim(),
    "financial_need", // always set, has a default
    form.career_goals.trim(),
    form.date_of_birth.trim(),
    form.state_of_origin.trim(),
    form.lga_of_origin.trim(),
    form.year_of_study.trim(),
    form.institution_type,
    form.jamb_score.trim(),
    form.waec_credit_count.trim(),
  ];
  const score = fields.filter(Boolean).length;
  return Math.round((score / total) * 100);
}

// Document/eligibility readiness -- separate from profile_completeness.
// Tracks whether the student has the paperwork most Nigerian scholarships
// require in hand, without storing the files themselves (Document Vault is
// still a deferred, later phase).
export function estimateReadiness(form: ProfileForm): number {
  const flags = [
    form.has_valid_id,
    form.has_transcript,
    form.has_recommendation_letter,
    form.has_personal_statement,
    form.has_lga_certificate,
  ];
  const met = flags.filter(Boolean).length;
  return Math.round((met / flags.length) * 100);
}
