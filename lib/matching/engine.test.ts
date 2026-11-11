import { describe, expect, it } from "vitest";
import { evaluateScholarship } from "./engine";
import type { MatchableProfile, ScholarshipRow, ScholarshipRule } from "./types";

const scholarship = {
  id: "waaw-2026-2027",
  title: "WAAW Foundation Scholarship 2026/2027",
  provider_name: "WAAW Foundation",
  description: null,
  amount: "US$500 one-time award",
  deadline: null,
  opens_at: null,
  last_cycle_closed_at: null,
  application_url: "https://waawfoundation.org/scholarship/",
  how_to_apply: null,
  level: "undergrad",
  discipline: "STEM",
  verified: true,
  awards_available: null,
  estimated_applicant_pool: null,
  competitiveness_tier: null,
  historical_acceptance_rate: null,
} satisfies ScholarshipRow;

const profile = (overrides: Partial<MatchableProfile> = {}): MatchableProfile => ({
  discipline: "Software Engineering",
  gpa: 4.5,
  nationality: "Nigerian",
  gender: "Female",
  financial_need: true,
  date_of_birth: "2004-01-01",
  state_of_origin: null,
  lga_of_origin: null,
  year_of_study: 200,
  institution_type: "federal_uni",
  jamb_score: 300,
  waec_credit_count: 8,
  has_english_maths_credit: true,
  disability_status: false,
  profile_completeness: 100,
  ...overrides,
});

const rules: ScholarshipRule[] = [
  { id: "gender", scholarship_id: scholarship.id, field: "gender", operator: "eq", value: "female" },
  { id: "age", scholarship_id: scholarship.id, field: "age", operator: "lte", value: 31 },
];

describe("WAAW eligibility rules", () => {
  it("does not treat a male student as an excellent match", () => {
    const result = evaluateScholarship(profile({ gender: "Male" }), scholarship, rules);
    expect(result.requirements.find((requirement) => requirement.field === "gender")?.status).toBe("not_met");
    expect(result.score).toBeLessThan(85);
    expect(result.tier).toBe("unlikely");
  });

  it("does not treat an applicant aged 32 or older as an excellent match", () => {
    const result = evaluateScholarship(profile({ date_of_birth: "1994-01-01" }), scholarship, rules);
    expect(result.requirements.find((requirement) => requirement.field === "age")?.status).toBe("not_met");
    expect(result.score).toBeLessThan(85);
    expect(result.tier).toBe("unlikely");
  });

  it("keeps a female applicant under 32 eligible when the other rule is met", () => {
    const result = evaluateScholarship(profile(), scholarship, rules);
    expect(result.requirements.every((requirement) => requirement.status === "met")).toBe(true);
    expect(result.score).toBe(100);
    expect(result.tier).toBe("excellent");
  });

  it("treats a failed year-of-study requirement as a hard eligibility gate", () => {
    const result = evaluateScholarship(profile({ year_of_study: 200 }), scholarship, [
      { id: "year", scholarship_id: scholarship.id, field: "year_of_study", operator: "eq", value: 100 },
    ]);

    expect(result.requirements.find((requirement) => requirement.field === "year_of_study")).toMatchObject({
      field: "year_of_study",
      status: "not_met",
      gating: true,
    });
    expect(result.eligibilityScore).toBe(0);
    expect(result.score).toBe(0);
    expect(result.rankScore).toBe(0);
    expect(result.tier).toBe("unlikely");
  });

  it("treats a failed CGPA threshold as a hard eligibility gate", () => {
    const result = evaluateScholarship(profile({ gpa: 3.49 }), scholarship, [
      { id: "gpa", scholarship_id: scholarship.id, field: "gpa", operator: "gte", value: 3.5 },
    ]);

    expect(result.requirements.find((requirement) => requirement.field === "gpa")).toMatchObject({ field: "gpa", status: "not_met", gating: true });
    expect(result.eligibilityScore).toBe(0);
    expect(result.score).toBe(0);
    expect(result.tier).toBe("unlikely");
  });
});
