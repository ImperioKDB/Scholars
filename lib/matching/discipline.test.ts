import { describe, expect, it } from "vitest";
import { disciplineRequirementMatches, isStemDiscipline } from "./discipline";
import { evaluateScholarship } from "./engine";
import type { MatchableProfile, ScholarshipRow } from "./types";

const profile = (discipline: string): MatchableProfile => ({
  discipline,
  gpa: null,
  nationality: "Nigerian",
  gender: null,
  financial_need: false,
  date_of_birth: null,
  state_of_origin: null,
  lga_of_origin: null,
  year_of_study: null,
  institution_type: null,
  jamb_score: null,
  waec_credit_count: null,
  has_english_maths_credit: false,
  disability_status: false,
  profile_completeness: 20,
});

const scholarship = {
  id: "taiwo-bankole",
  title: "Taiwo Bankole Prize 2026",
  provider_name: "Taiwo Bankole Prize",
  description: null,
  amount: null,
  deadline: null,
  opens_at: null,
  last_cycle_closed_at: null,
  application_url: null,
  how_to_apply: null,
  level: "undergrad",
  discipline: "Science, Technology, Engineering, Mathematics (STEM), or Law",
  verified: true,
  awards_available: null,
  estimated_applicant_pool: null,
  competitiveness_tier: null,
  historical_acceptance_rate: null,
} satisfies ScholarshipRow;

describe("discipline matching", () => {
  it("classifies Software Engineering as STEM", () => {
    expect(isStemDiscipline("Software Engineering")).toBe(true);
    expect(disciplineRequirementMatches("Software Engineering", "STEM")).toBe(true);
    expect(disciplineRequirementMatches("Software Engineering", scholarship.discipline)).toBe(true);
  });

  it("keeps unrelated disciplines out of broad STEM requirements", () => {
    expect(isStemDiscipline("English Language")).toBe(false);
    expect(disciplineRequirementMatches("English Language", scholarship.discipline)).toBe(false);
    expect(disciplineRequirementMatches("Law", scholarship.discipline)).toBe(true);
  });

  it("uses the classifier inside the scholarship eligibility engine", () => {
    const result = evaluateScholarship(profile("Software Engineering"), scholarship, []);
    expect(result.requirements[0]?.status).toBe("met");
    expect(result.tier).not.toBe("unlikely");
  });
});
