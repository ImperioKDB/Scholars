const NORMALIZED_STEM_DISCIPLINES = new Set([
  "agricultural engineering",
  "agricultural and bio-resources engineering",
  "architecture",
  "biochemistry",
  "biology",
  "botany",
  "chemical engineering",
  "chemistry",
  "civil engineering",
  "computer engineering",
  "computer science",
  "computer science education",
  "cyber security",
  "data science",
  "electrical/electronics engineering",
  "environmental health science",
  "geology",
  "industrial chemistry",
  "information technology",
  "mathematics",
  "mathematics education",
  "mechanical engineering",
  "medical laboratory science",
  "medicine and surgery",
  "mechatronics engineering",
  "meteorology",
  "microbiology",
  "nursing science",
  "optometry",
  "pharmacy",
  "physics",
  "physiology",
  "physiotherapy",
  "radiography",
  "software engineering",
  "statistics",
  "veterinary medicine",
  "zoology",
]);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Returns true when a student course belongs to the broad STEM family. */
export function isStemDiscipline(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const normalized = normalize(value);
  if (NORMALIZED_STEM_DISCIPLINES.has(normalized)) return true;
  if (/\b(social science|social sciences)\b/.test(normalized)) return false;
  return /\b(engineering|technology|mathematics|math(?:ematics)?|physics|chemistry|biology|biochemistry|microbiology|geology|statistics|computer science|software|cyber|data science|information technology|medical laboratory|medicine|nursing|pharmacy|physiotherapy|radiography|optometry|veterinary)\b/.test(normalized);
}

/** Returns true for a requirement that names STEM as a category, not a literal course. */
export function isBroadStemRequirement(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const normalized = normalize(value);
  return normalized === "stem" || /\bstem\b/.test(normalized) || (
    /\bscience\b/.test(normalized) &&
    /\btechnology\b/.test(normalized) &&
    /\bengineering\b/.test(normalized) &&
    /\bmathematics?\b/.test(normalized)
  );
}

export function disciplineRequirementMatches(profileValue: unknown, ruleValue: unknown): boolean {
  if (typeof profileValue !== "string" || typeof ruleValue !== "string") return false;
  if (normalize(profileValue) === normalize(ruleValue)) return true;
  if (isBroadStemRequirement(ruleValue) && isStemDiscipline(profileValue)) return true;
  return /\blaw\b/.test(normalize(ruleValue)) && normalize(profileValue) === "law";
}
