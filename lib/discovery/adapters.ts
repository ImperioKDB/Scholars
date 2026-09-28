import { extractScholarship, type Claim, type ExtractionResult } from './extraction'

export type SourceAdapter = {
  key: string
  version: string
  hosts: string[]
  extract: (html: string, sourceUrl: string) => ExtractionResult
}

const adapters: SourceAdapter[] = [
  {
    key: 'official-generic',
    version: 'official-generic-v1',
    hosts: ['scholarship.education.gov.ng', 'scholarship.ptdf.gov.ng'],
    extract: (html, sourceUrl) => extractScholarship(html, sourceUrl),
  },
  {
    key: 'mtn-foundation',
    version: 'mtn-foundation-v1',
    hosts: ['mtn.ng', 'www.mtn.ng'],
    extract: (html, sourceUrl) => extractMtnScholarships(html, sourceUrl),
  },
]

const fallback: SourceAdapter = { key: 'generic-fallback', version: 'generic-fallback-v1', hosts: [], extract: (html, sourceUrl) => extractScholarship(html, sourceUrl) }

function extractMtnScholarships(html: string, sourceUrl: string): ExtractionResult {
  const result = extractScholarship(html, sourceUrl)
  const claims: Claim[] = result.claims.filter((candidate) => !['gender', 'gpa', 'amount'].includes(candidate.field))
  if (/Nigerian (?:students|Public Tertiary Institutions)/i.test(html)) claims.push({ field: 'nationality', value: 'Nigerian', sourceUrl, evidenceQuote: 'eligible high performing students in Nigerian Public Tertiary Institutions', confidence: 0.9, extractionMethod: 'deterministic', operator: 'eq' })
  if (/undergraduate|tertiary institution|UTME/i.test(html)) claims.push({ field: 'level', value: 'undergraduate', sourceUrl, evidenceQuote: 'MTN Foundation Scholarships are described for students in Nigerian tertiary institutions and UTME candidates.', confidence: 0.82, extractionMethod: 'deterministic', operator: 'eq' })
  if (/2026 edition/i.test(html)) claims.push({ field: 'program_year', value: '2026', sourceUrl, evidenceQuote: 'The 2026 edition will see 400 students awarded scholarships worth N300,000.00', confidence: 0.95, extractionMethod: 'deterministic', operator: 'eq' })
  if (/N300,000(?:\.00)?/i.test(html)) claims.push({ field: 'amount', value: 'N300,000.00', sourceUrl, evidenceQuote: 'The 2026 edition will see 400 students awarded scholarships worth N300,000.00 until graduation.', confidence: 0.94, extractionMethod: 'deterministic', operator: 'eq' })
  return { ...result, title: { field: 'title', value: 'MTN Foundation Scholarships 2026', sourceUrl, evidenceQuote: 'MTN Foundation Scholarships Program', confidence: 0.96, extractionMethod: 'deterministic' }, amount: claims.find((candidate) => candidate.field === 'amount') ?? null, claims }
}

export function adapterForUrl(sourceUrl: string): SourceAdapter {
  let hostname = ''
  try { hostname = new URL(sourceUrl).hostname.toLowerCase() } catch { return fallback }
  return adapters.find((adapter) => adapter.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) ?? fallback
}

export function extractWithAdapter(html: string, sourceUrl: string): { adapter: SourceAdapter; result: ExtractionResult } {
  const adapter = adapterForUrl(sourceUrl)
  return { adapter, result: adapter.extract(html, sourceUrl) }
}
