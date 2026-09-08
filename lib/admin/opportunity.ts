import { z } from "zod";
import { DISCIPLINE_OPTIONS } from "@/lib/profile";

export type OpportunityType = "fellowship" | "internship" | "competition" | "mentorship";

export const OPPORTUNITY_TYPE_OPTIONS: { value: OpportunityType; label: string }[] = [
  { value: "fellowship", label: "Fellowship" },
  { value: "internship", label: "Internship" },
  { value: "competition", label: "Competition" },
  { value: "mentorship", label: "Mentorship" },
];

export { DISCIPLINE_OPTIONS };

// Mirrors the live `opportunities` table. All fields optional except
// type/title/provider_name -- deadline itself is intentionally NOT
// required, unlike scholarships: mentorships and some internships run on
// a rolling basis with no fixed close date.
export const opportunitySchema = z.object({
  type: z.enum(["fellowship", "internship", "competition", "mentorship"]),
  title: z.string().min(3, "Title is required."),
  provider_name: z.string().min(2, "Provider name is required."),
  description: z.string().optional(),
  eligibility_notes: z.string().max(2000, "Keep it under 2000 characters.").optional(),
  duration: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  compensation: z.string().max(200).optional(),
  discipline: z.string().optional(),
  deadline: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  opens_at: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  application_url: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), "Must be a full URL starting with http(s)://"),
  how_to_apply: z.string().max(2000, "Keep it under 2000 characters.").optional(),
  verified: z.boolean(),
  research_notes: z.string().max(2000, "Keep it under 2000 characters.").optional(),
});

export type OpportunityFormValues = z.infer<typeof opportunitySchema>;

export const EMPTY_OPPORTUNITY: OpportunityFormValues = {
  type: "internship",
  title: "",
  provider_name: "",
  description: "",
  eligibility_notes: "",
  duration: "",
  location: "",
  compensation: "",
  discipline: "",
  deadline: "",
  opens_at: "",
  application_url: "",
  how_to_apply: "",
  verified: false,
  research_notes: "",
};
