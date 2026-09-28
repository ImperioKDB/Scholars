import { describe, expect, it } from 'vitest'
import { isUnsafeAddress, validateFetchUrl } from './safeFetch'
import { extractScholarship } from './extraction'

describe('safe fetch URL policy', () => {
  it('rejects private and reserved addresses', () => {
    expect(isUnsafeAddress('127.0.0.1')).toBe(true)
    expect(isUnsafeAddress('10.0.0.8')).toBe(true)
    expect(isUnsafeAddress('192.168.1.5')).toBe(true)
    expect(isUnsafeAddress('::1')).toBe(true)
    expect(isUnsafeAddress('fc00::1')).toBe(true)
    expect(isUnsafeAddress('8.8.8.8')).toBe(false)
  })

  it('requires HTTPS and an approved host', () => {
    expect(() => validateFetchUrl('http://official.example/page', ['official.example'])).toThrow('https_required')
    expect(() => validateFetchUrl('https://evil.example/page', ['official.example'])).toThrow('host_not_allowed')
    expect(validateFetchUrl('https://apply.official.example/page', ['official.example']).hostname).toBe('apply.official.example')
  })

  it('rejects credentials, ports, and raw IP URLs', () => {
    expect(() => validateFetchUrl('https://user:pass@official.example/page', ['official.example'])).toThrow('unsafe_url_credentials_or_port')
    expect(() => validateFetchUrl('https://official.example:8443/page', ['official.example'])).toThrow('unsafe_url_credentials_or_port')
    expect(() => validateFetchUrl('https://8.8.8.8/page', ['8.8.8.8'])).toThrow('host_not_allowed')
  })
})

describe('structured extraction', () => {
  it('extracts evidence-backed fields and keeps unsupported fields unknown', () => {
    const result = extractScholarship(`<!doctype html><html><head><title>Future Leaders Scholarship 2026</title></head><body><p>Applications close 30 September 2026.</p><p>Open to Nigerian undergraduate students with a JAMB score of 220.</p><p>Award: ₦250,000 per session.</p><a href="https://official.example/apply">Apply now</a></body></html>`, 'https://official.example/scholarship')
    expect(result.title?.value).toBe('Future Leaders Scholarship 2026')
    expect(result.deadline?.value).toBe('2026-09-30')
    expect(result.amount?.value).toContain('250,000')
    expect(result.applicationUrl?.value).toBe('https://official.example/apply')
    expect(result.claims.some((claim) => claim.field === 'nationality')).toBe(true)
    expect(result.claims.some((claim) => claim.field === 'jamb_score' && claim.value === 220)).toBe(true)
    expect(result.discipline).toBeNull()
  })

  it('marks ambiguous pages partial rather than inventing dates', () => {
    const result = extractScholarship('<html><head><title>General Award</title></head><body><p>Funding information coming soon.</p></body></html>', 'https://official.example/award')
    expect(result.deadline).toBeNull()
    expect(result.amount).toBeNull()
    expect(result.status).toBe('partial')
  })
})
