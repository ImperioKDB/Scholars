// lib/matching/engine.ts
// Deterministic, rule-based eligibility + scoring. No ML per PRD MVP scope.
//
// Eligibility: a scholarship is eligible for a profile only if every one
// of its scholarship_rules evaluates true against the profile. Missing
// profile data fails the rule (conservative — we don't guess).
//
// Score (0-100, only computed for eligible scholarships):
//   70  base for being eligible at all
//   +20 * (profile_completeness / 100)   — rewards fuller profiles
//   +5  if scholarship.level exactly matches profile.academic_level
//       (0 if scholarship.level is 'both', since it's not a real signal)
//   +5  if scholarship.discipline is null (open to any) or matches exactly
//   +up to 5, inversely proportional to days until deadline, capped at
//       5 for deadlines <=14 days out — surfaces urgent-but-eligible
//       matches without letting expired-soon items dominate ranking
//
// Ties broken by soonest deadline first.

export type AcademicLevel = 'undergrad' | 'postgrad'
export type ScholarshipLevel = 'undergrad' | 'postgrad' | 'both'
export type RuleOperator = 'eq' | 'gte' | 'lte' | 'in' | 'exists'

export interface Profile {
  id: string
  academic_level: AcademicLevel | null
  discipline: string | null
  gpa: number | null
  nationality: string | null
  gender: string | null
  financial_need: boolean
  career_goals: string | null
  profile_completeness: number
}

export interface ScholarshipRule {
  id: string
  scholarship_id: string
  field: string
  operator: RuleOperator
  value: unknown
}

export interface Scholarship {
  id: string
  title: string
  provider_name: string
  description: string | null
  amount: string | null
  deadline: string // ISO date
  application_url: string | null
  level: ScholarshipLevel
  discipline: string | null
  verified: boolean
  scholarship_rules: ScholarshipRule[]
}

export interface MatchResult {
  scholarship: Omit<Scholarship, 'scholarship_rules'>
  eligible: boolean
  score: number
  failed_rules: { field: string; operator: RuleOperator; value: unknown }[]
}

// Map a rule's `field` string to the profile's actual value.
function getProfileValue(profile: Profile, field: string): unknown {
  switch (field) {
    case 'gpa':
      return profile.gpa
    case 'nationality':
      return profile.nationality
    case 'gender':
      return profile.gender
    case 'financial_need':
      return profile.financial_need
    case 'academic_level':
      return profile.academic_level
    case 'discipline':
      return profile.discipline
    case 'career_goals':
      return profile.career_goals
    default:
      return undefined
  }
}

function evaluateRule(profile: Profile, rule: ScholarshipRule): boolean {
  const actual = getProfileValue(profile, rule.field)

  switch (rule.operator) {
    case 'exists':
      return actual !== null && actual !== undefined && actual !== ''

    case 'eq':
      if (actual === null || actual === undefined) return false
      // Case-insensitive compare for strings (nationality, discipline, etc.)
      if (typeof actual === 'string' && typeof rule.value === 'string') {
        return actual.toLowerCase() === rule.value.toLowerCase()
      }
      return actual === rule.value

    case 'gte': {
      if (actual === null || actual === undefined) return false
      const a = Number(actual)
      const b = Number(rule.value)
      if (Number.isNaN(a) || Number.isNaN(b)) return false
      return a >= b
    }

    case 'lte': {
      if (actual === null || actual === undefined) return false
      const a = Number(actual)
      const b = Number(rule.value)
      if (Number.isNaN(a) || Number.isNaN(b)) return false
      return a <= b
    }

    case 'in': {
      if (actual === null || actual === undefined) return false
      if (!Array.isArray(rule.value)) return false
      if (typeof actual === 'string') {
        return rule.value.some(
          (v) => typeof v === 'string' && v.toLowerCase() === actual.toLowerCase()
        )
      }
      return rule.value.includes(actual)
    }

    default:
      return false
  }
}

function levelMatches(profile: Profile, scholarship: Scholarship): boolean {
  if (scholarship.level === 'both') return true
  if (!profile.academic_level) return false
  return scholarship.level === profile.academic_level
}

function urgencyBonus(deadline: string): number {
  const days = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  if (days < 0) return 0 // already past — shouldn't normally be queried, but don't reward it
  if (days <= 14) return 5
  if (days >= 90) return 0
  // linear falloff between 14 and 90 days
  return Math.round(5 * (1 - (days - 14) / (90 - 14)))
}

export function computeMatches(
  profile: Profile,
  scholarships: Scholarship[],
  opts: { includeIneligible?: boolean } = {}
): MatchResult[] {
  const results: MatchResult[] = []

  for (const scholarship of scholarships) {
    const { scholarship_rules, ...rest } = scholarship
    const failed_rules: MatchResult['failed_rules'] = []

    // Level is a structural gate, not a scholarship_rules row, evaluated separately.
    const levelOk = levelMatches(profile, scholarship)
    if (!levelOk) {
      failed_rules.push({ field: 'academic_level', operator: 'eq', value: scholarship.level })
    }

    for (const rule of scholarship_rules) {
      if (!evaluateRule(profile, rule)) {
        failed_rules.push({ field: rule.field, operator: rule.operator, value: rule.value })
      }
    }

    const eligible = failed_rules.length === 0

    if (!eligible && !opts.includeIneligible) continue

    let score = 0
    if (eligible) {
      score += 70
      score += 20 * (profile.profile_completeness / 100)
      if (scholarship.level !== 'both') score += 5
      if (!scholarship.discipline) score += 5
      else if (
        profile.discipline &&
        scholarship.discipline.toLowerCase() === profile.discipline.toLowerCase()
      ) {
        score += 5
      }
      score += urgencyBonus(scholarship.deadline)
      score = Math.min(100, Math.round(score))
    }

    results.push({ scholarship: rest, eligible, score, failed_rules })
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (
      new Date(a.scholarship.deadline).getTime() -
      new Date(b.scholarship.deadline).getTime()
    )
  })

  return results
}
