// app/api/admin/scholarships/[id]/rules/route.ts
// POST /api/admin/scholarships/[id]/rules — add a single eligibility rule
// to an existing scholarship, admin only.
//
// The rules API only exposes add-one / delete-one, deliberately, to keep
// each write small and auditable rather than one call silently wiping and
// rebuilding a rule set.
//
// INPUT HARDENING: `value` used to be z.unknown() -- any jsonb sailed
// straight into the database and into the matching engine's String()
// coercions (unbounded arrays included). It is now validated per
// field+operator: typed scalars with sane ranges, bounded string arrays
// for `in`, `true` normalized for `exists`, and operator/field
// combinations restricted to what the engine supports. This mirrors what
// the admin form's serializeRuleValue() already produces client-side, so
// the server no longer trusts the client's serialization.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { assertAdmin } from '@/lib/admin/guard'
import { isUuid } from '@/lib/validate'

const RULE_FIELDS = [
  'discipline',
  'gpa',
  'nationality',
  'gender',
  'financial_need',
  'age',
  'state_of_origin',
  'lga_of_origin',
  'year_of_study',
  'institution_type',
  'jamb_score',
  'waec_credit_count',
  'has_english_maths_credit',
  'disability_status',
  'career_goals',
] as const

const NUMERIC_RULE_FIELDS = new Set(['gpa', 'age', 'year_of_study', 'jamb_score', 'waec_credit_count'])
const INTEGER_RULE_FIELDS = new Set(['age', 'year_of_study', 'jamb_score', 'waec_credit_count'])
const BOOLEAN_RULE_FIELDS = new Set(['financial_need', 'has_english_maths_credit', 'disability_status'])
const NUMERIC_LIMITS: Record<string, [number, number]> = {
  gpa: [0, 5],
  age: [0, 120],
  year_of_study: [100, 600],
  jamb_score: [0, 400],
  waec_credit_count: [0, 9],
}
const MAX_IN_VALUES = 100
const MAX_VALUE_LENGTH = 300

// Returns { error: null, normalized } when valid, else a human-readable
// reason. `normalized` is what actually gets stored: trimmed strings,
// trimmed array entries, `true` for exists -- never the raw client value.
function validateRuleValue(
  field: string,
  operator: string,
  value: unknown
): { error: string | null; normalized: unknown } {
  if (operator === 'exists') {
    return { error: null, normalized: true }
  }
  if (operator === 'gte' || operator === 'lte') {
    if (!NUMERIC_RULE_FIELDS.has(field)) {
      return { error: `'${operator}' is only supported for numeric fields`, normalized: null }
    }
  }
  if (operator === 'in') {
    if (NUMERIC_RULE_FIELDS.has(field) || BOOLEAN_RULE_FIELDS.has(field)) {
      return { error: `'in' is not supported for ${field}`, normalized: null }
    }
    if (!Array.isArray(value)) return { error: "'in' rules need an array value", normalized: null }
    if (value.length === 0) return { error: "'in' rules need at least one value", normalized: null }
    if (value.length > MAX_IN_VALUES) {
      return { error: `'in' rules accept at most ${MAX_IN_VALUES} values`, normalized: null }
    }
    const items: string[] = []
    for (const v of value) {
      if (typeof v !== 'string') return { error: "'in' values must all be strings", normalized: null }
      const t = v.trim()
      if (!t) return { error: "'in' values must not be empty", normalized: null }
      if (t.length > 200) return { error: "'in' values are limited to 200 characters", normalized: null }
      items.push(t)
    }
    return { error: null, normalized: items }
  }
  if (NUMERIC_RULE_FIELDS.has(field)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { error: `${field} rules need a numeric value`, normalized: null }
    }
    if (INTEGER_RULE_FIELDS.has(field) && !Number.isInteger(value)) {
      return { error: `${field} rules need a whole number`, normalized: null }
    }
    const [min, max] = NUMERIC_LIMITS[field]
    if (value < min || value > max) {
      return { error: `${field} must be between ${min} and ${max}`, normalized: null }
    }
    return { error: null, normalized: value }
  }
  if (BOOLEAN_RULE_FIELDS.has(field)) {
    if (typeof value !== 'boolean') {
      return { error: `${field} rules need true or false`, normalized: null }
    }
    return { error: null, normalized: value }
  }
  if (typeof value !== 'string') {
    return { error: `${field} rules need a string value`, normalized: null }
  }
  const trimmed = value.trim()
  if (!trimmed) return { error: `${field} rules need a non-empty value`, normalized: null }
  if (trimmed.length > MAX_VALUE_LENGTH) {
    return { error: `${field} values are limited to ${MAX_VALUE_LENGTH} characters`, normalized: null }
  }
  return { error: null, normalized: trimmed }
}

const ruleSchema = z.object({
  field: z.enum(RULE_FIELDS),
  operator: z.enum(['eq', 'gte', 'lte', 'in', 'exists']),
  value: z.unknown(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: scholarshipId } = await params
  // INPUT HARDENING: path params are user input.
  if (!isUuid(scholarshipId)) {
    return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
  }

  const limited = await checkRateLimit(request, { route: 'admin-rules', limit: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const guard = await assertAdmin(supabase)
  if (!guard.ok) return guard.response

  const raw = await request.json().catch(() => null)
  const parsed = ruleSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid rule data', issues: parsed.error.issues }, { status: 400 })
  }

  const { field, operator, value } = parsed.data
  const check = validateRuleValue(field, operator, value)
  if (check.error) {
    return NextResponse.json({ error: check.error }, { status: 400 })
  }

  const { data: rule, error } = await supabase
    .from('scholarship_rules')
    .insert({ field, operator, value: check.normalized, scholarship_id: scholarshipId })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule }, { status: 201 })
}
