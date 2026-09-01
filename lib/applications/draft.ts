// lib/applications/draft.ts
//
// Auto-apply v1: builds the two pieces of an "application draft" for a
// scholarship a student is tracking.
//
//   - summary: deterministic, built directly from profile columns -- no AI
//     involved, so it can never hallucinate a GPA, a state of origin, or a
//     document the student doesn't actually have.
//   - statement: an AI-drafted personal statement, the one part that
//     genuinely benefits from generation. The student reviews, edits, and
//     confirms it before using it.
//
// SCOPE: this never submits anything to a third-party portal. There is no
// reliable, safe way to automate arbitrary scholarship application forms
// across dozens of different providers. "Confirming" a draft here means
// "this is what I'll use" -- the student then copies it into the
// scholarship's own application_url.

export type DraftFact = { label: string; value: string };
export type DraftChecklistItem = { item: string; have: boolean };
export type DraftSummary = { facts: DraftFact[]; checklist: DraftChecklistItem[] };

export type DraftProfileInput = {
  full_name: string | null;
  institution_name: string | null;
  institution_type: string | null;
  discipline: string | null;
  year_of_study: number | null;
  state_of_origin: string | null;
  lga_of_origin: string | null;
  gpa: number | null;
  jamb_score: number | null;
  waec_credit_count: number | null;
  has_english_maths_credit: boolean;
  financial_need: boolean;
  disability_status: boolean;
  career_goals: string | null;
  has_valid_id: boolean;
  has_transcript: boolean;
  has_recommendation_letter: boolean;
  has_personal_statement: boolean;
  has_lga_certificate: boolean;
};

type DraftWaecRow = { subject: string; grade: string };

type DraftScholarshipInput = {
  title: string;
  provider_name: string;
  description: string | null;
  discipline: string | null;
};

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  federal_uni: "Federal University",
  state_uni: "State University",
  private_uni: "Private University",
  polytechnic: "Polytechnic / Monotechnic",
  college_of_education: "College of Education",
};

function fullNameOf(profile: DraftProfileInput): string {
  return profile.full_name?.trim() || "Student";
}

// Deterministic -- pulled straight from columns the student already
// entered. This is the sheet the student actually copies numbers and
// answers from into the real application form.
export function buildDraftSummary(profile: DraftProfileInput, waecResults: DraftWaecRow[]): DraftSummary {
  const facts: DraftFact[] = [
    { label: "Full name", value: fullNameOf(profile) },
    { label: "Institution", value: profile.institution_name || "Not set" },
    {
      label: "Institution type",
      value: profile.institution_type
        ? INSTITUTION_TYPE_LABELS[profile.institution_type] ?? profile.institution_type
        : "Not set",
    },
    { label: "Discipline", value: profile.discipline || "Not set" },
    { label: "Year of study", value: profile.year_of_study ? `${profile.year_of_study} Level` : "Not set" },
    { label: "State of origin", value: profile.state_of_origin || "Not set" },
    { label: "LGA of origin", value: profile.lga_of_origin || "Not set" },
    { label: "GPA / CGPA", value: profile.gpa != null ? String(profile.gpa) : "Not set" },
    { label: "JAMB / UTME score", value: profile.jamb_score != null ? String(profile.jamb_score) : "Not set" },
    {
      label: "WAEC credits",
      value:
        profile.waec_credit_count != null
          ? `${profile.waec_credit_count} credit${profile.waec_credit_count === 1 ? "" : "s"}${
              profile.has_english_maths_credit ? " (incl. English & Maths)" : ""
            }`
          : "Not set",
    },
    { label: "Financial need", value: profile.financial_need ? "Yes" : "No" },
    { label: "Disability status", value: profile.disability_status ? "Yes" : "No" },
  ];

  if (waecResults.length > 0) {
    facts.push({
      label: "WAEC subjects",
      value: waecResults.map((r) => `${r.subject}: ${r.grade}`).join(", "),
    });
  }

  const checklist: DraftChecklistItem[] = [
    { item: "Valid means of identification", have: profile.has_valid_id },
    { item: "Academic transcript / statement of results", have: profile.has_transcript },
    { item: "Recommendation letter", have: profile.has_recommendation_letter },
    { item: "Personal statement / letter of motivation", have: profile.has_personal_statement },
    { item: "LGA / state of origin certificate", have: profile.has_lga_certificate },
  ];

  return { facts, checklist };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\u2026` : text;
}

// Everything the model needs is passed explicitly -- no hidden lookups --
// so the output is grounded only in what the student actually entered.
export function buildStatementPrompt(
  profile: DraftProfileInput,
  scholarship: DraftScholarshipInput,
  metRequirementLabels: string[]
): string {
  const name = fullNameOf(profile);

  return `You are helping a Nigerian undergraduate student draft a personal statement / letter of motivation for a specific scholarship application. Write in the student's voice -- first person, sincere, concrete, no generic filler ("passionate about", "since a young age"). 250-350 words. Plain paragraphs, no headers or bullet points.

Student facts (use only what's relevant, do not invent anything beyond this):
- Name: ${name}
- Institution: ${profile.institution_name || "not specified"}
- Discipline: ${profile.discipline || "not specified"}
- Year of study: ${profile.year_of_study ? `${profile.year_of_study} Level` : "not specified"}
- State of origin: ${profile.state_of_origin || "not specified"}
- GPA/CGPA: ${profile.gpa != null ? profile.gpa : "not specified"}
- Career goals: ${profile.career_goals ? truncate(profile.career_goals, 400) : "not specified"}
- Financial need: ${profile.financial_need ? "yes" : "not indicated"}
- Disability status: ${profile.disability_status ? "yes" : "not indicated"}

Scholarship:
- Title: ${scholarship.title}
- Provider: ${scholarship.provider_name}
- Field: ${scholarship.discipline || "open to any discipline"}
- Description: ${scholarship.description ? truncate(scholarship.description, 500) : "not provided"}

Eligibility strengths this student meets (weave in naturally, don't list them mechanically): ${
    metRequirementLabels.length > 0 ? metRequirementLabels.join("; ") : "general eligibility"
  }

Write the statement now. Do not include a greeting, a subject line, or a sign-off -- just the statement body.`;
}

// Google Gemini (AI Studio) -- free tier, no credit card required. Get a
// key at https://aistudio.google.com/apikey and set it as GEMINI_API_KEY
// in Vercel. Free-tier limits (as of writing, gemini-2.5-flash-lite): 1,500
// requests/day, 15/minute -- comfortably enough for draft generation.
type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
};

export async function generateStatement(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY env var");
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
      }),
    }
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Gemini API error ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini API returned no text content");
  }

  return text;
}
