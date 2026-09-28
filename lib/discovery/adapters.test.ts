import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractWithAdapter } from './adapters'

describe('source adapters', () => {
  it('extracts MTN scholarship evidence from the public fixture', () => {
    const html = readFileSync(join(process.cwd(), 'lib/discovery/fixtures/mtn-scholarships.html'), 'utf8')
    const { adapter, result } = extractWithAdapter(html, 'https://www.mtn.ng/scholarships/')
    expect(adapter.key).toBe('mtn-foundation')
    expect(adapter.version).toBe('mtn-foundation-v1')
    expect(result.title?.value).toBe('MTN Foundation Scholarships 2026')
    expect(result.claims.some((claim) => claim.field === 'nationality' && claim.value === 'Nigerian')).toBe(true)
    expect(result.claims.some((claim) => claim.field === 'level' && claim.value === 'undergraduate')).toBe(true)
    expect(result.claims.some((claim) => claim.field === 'program_year' && claim.value === '2026')).toBe(true)
    expect(result.claims.some((claim) => claim.field === 'amount' && claim.value === 'N300,000.00')).toBe(true)
    expect(result.claims.some((claim) => claim.field === 'gender')).toBe(false)
    expect(result.claims.some((claim) => claim.field === 'gpa')).toBe(false)
  })
})
