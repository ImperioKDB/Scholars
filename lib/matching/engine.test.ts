import { describe, expect, it } from "vitest";
import { evaluateScholarship } from "./engine";
import type { MatchableProfile, ScholarshipRow } from "./types";

const profile: MatchableProfile = {
  discipline: "Software Engineering",
  gpa: 4.2,
  nationality: "Nigerian",
  gender: "Female",
  financial_need: false,
  date_of_birth: "2002-01-01",
  state_of_origin: "Lagos",
  lga_of_origin: "Ikeja",
  year_of_study: 300,
  institution_type: "polytechnic",
  jamb_score: 250,
  waec_credit_count: 8,
  has_english_maths_credit: true,
  disability_status: false,
  profile_completeness: 100,
};

const scholarship: ScholarshipRow = {
  id: "scholarship-1",
  title: "Test scholarship",
  provider_name: "Test provider",
  description: null,
  amount: null,
  deadline: null,
  opens_at: null,
  last_cycle_closed_at: null,
  application_url: null,
  how_to_apply: null,
  level: "undergrad",
  discipline: "Software Engineering",
  verified: true,
  awards_available: null,
  estimated_applicant_pool: null,
  competitiveness_tier: null,
  historical_acceptance_rate: null,
};

describe("scholarship requirement labels", () => {
  it("keeps field of study separate from institution type", () => {
    const match = evaluateScholarship(profile, scholarship, [
      {
        id: "rule-1",
        scholarship_id: scholarship.id,
        field: "institution_type",
        operator: "eq",
        value: "polytechnic",
      },
    ]);

    expect(match.requirements.map((requirement) => requirement.requirement)).toEqual([
      "Field of study must be Software Engineering",
      "Institution type must be Polytechnic / Monotechnic",
    ]);
    expect(match.requirements.map((requirement) => requirement.field)).toEqual([
      "discipline",
      "institution_type",
    ]);
  });
});
