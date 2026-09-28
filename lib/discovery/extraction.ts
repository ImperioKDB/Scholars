import { createHash } from 'node:crypto'

export const EXTRACTOR_VERSION = 'deterministic-v1'

export type Claim = {
  field: string
  value: string | number | boolean | null
  operator?: string
  sourceUrl: string
  evidenceQuote: string
  confidence: number
  extractionMethod: 'deterministic'
}

export type ExtractionResult = {
  status: 'complete' | 'partial' | 'unclear' | 'failed'
  inputHash: string
  title: Claim | null
  providerName: Claim | null
  description: Claim | null
  applicationUrl: Claim | null
  deadline: Claim | null
  amount: Claim | null
  level: Claim
  discipline: Claim | null
  claims: Claim[]
  contradictions: string[]
}

function clean(value: string): string { return value.replace(/\s+/g, ' ').trim() }
function decode(value: string): string { return clean(value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')) }
function textFromHtml(html: string): string { return decode(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')) }
function quote(text: string, needle: string): string { const index = text.toLowerCase().indexOf(needle.toLowerCase()); return index < 0 ? text.slice(0, 400) : text.slice(Math.max(0, index - 120), Math.min(text.length, index + needle.length + 280)) }
function claim(field: string, value: Claim['value'], sourceUrl: string, evidenceQuote: string, confidence = 0.8, operator?: string): Claim { return { field, value, sourceUrl, evidenceQuote: clean(evidenceQuote).slice(0, 500), confidence, extractionMethod: 'deterministic', ...(operator ? { operator } : {}) } }
function htmlTitle(html: string): string | null { const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return match ? decode(match[1]) : null }
function applicationLink(html: string): { href: string; text: string } | null {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({ href: match[1], text: decode(match[2].replace(/<[^>]+>/g, ' ')) }))
  return links.find((link) => /apply|application|register|submit/i.test(`${link.text} ${link.href}`)) ?? null
}
function dateValue(text: string): { value: string; evidence: string } | null {
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (iso) return { value: `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`, evidence: quote(text, iso[0]) }
  const long = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i)
  if (!long) return null
  const month = new Date(`${long[2]} 1, ${long[3]}`).getMonth() + 1
  return { value: `${long[3]}-${String(month).padStart(2, '0')}-${long[1].padStart(2, '0')}`, evidence: quote(text, long[0]) }
}

export function extractScholarship(html: string, sourceUrl: string): ExtractionResult {
  const inputHash = createHash('sha256').update(html).digest('hex')
  const text = textFromHtml(html)
  const titleValue = htmlTitle(html) ?? text.match(/\b[A-Z][^.!?]{8,120}(?:Scholarship|Bursary|Award)\b/)?.[0] ?? null
  const providerMatch = text.match(/(?:provided|offered|administered|sponsored)\s+by\s+([A-Z][A-Za-z0-9 &'-]{2,100})/i)
  const app = applicationLink(html)
  const deadline = dateValue(text.match(/(?:deadline|closes|closing date|applications close)[^.!?]{0,100}/i)?.[0] ?? '')
  const amountMatch = text.match(/(?:₦|N|USD|\$)\s?[\d,]+(?:\.\d+)?(?:\s+(?:per year|per session|monthly|one[- ]off))?/i)
  const levelValue = /undergraduate|bachelor|first degree|tertiary/i.test(text) ? 'undergraduate' : /postgraduate|master(?:'s)?|phd|doctoral/i.test(text) ? 'postgraduate' : 'unclear'
  const levelEvidence = quote(text, levelValue === 'undergraduate' ? 'undergraduate' : levelValue === 'postgraduate' ? 'postgraduate' : text.slice(0, 80))
  const claims: Claim[] = []
  if (/Nigerian|Nigeria/i.test(text)) claims.push(claim('nationality', 'Nigerian', sourceUrl, quote(text, 'Niger'), 0.75, 'eq'))
  const gender = text.match(/(?:female|male|women|girls|men|boys)[^.!?]{0,80}/i)
  if (gender) claims.push(claim('gender', /female|women|girls/i.test(gender[0]) ? 'female' : 'male', sourceUrl, gender[0], 0.7, 'eq'))
  const state = text.match(/(?:indigene|state of origin|resident of)\s+([A-Z][A-Za-z -]{2,40})/i)
  if (state) claims.push(claim('state_of_origin', state[1].trim(), sourceUrl, state[0], 0.65, 'eq'))
  const jamb = text.match(/JAMB[^\d]{0,20}(\d{2,3})/i)
  if (jamb) claims.push(claim('jamb_score', Number(jamb[1]), sourceUrl, jamb[0], 0.8, 'gte'))
  const gpa = text.match(/GPA[^\d]{0,20}(\d(?:\.\d+)?)/i)
  if (gpa) claims.push(claim('gpa', Number(gpa[1]), sourceUrl, gpa[0], 0.8, 'gte'))
  if (deadline) claims.push(claim('deadline', deadline.value, sourceUrl, deadline.evidence, 0.75))
  if (app) claims.push(claim('application_url', new URL(app.href, sourceUrl).toString(), sourceUrl, app.text || app.href, 0.8))
  const contradictions: string[] = []
  const dates = [...text.matchAll(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g)].map((match) => match[0])
  if (new Set(dates).size > 1 && /deadline|closing date|closes/i.test(text)) contradictions.push('Multiple date values appear near deadline language; human confirmation required.')
  const status = !titleValue || !providerMatch && !sourceUrl ? 'failed' : contradictions.length || !deadline || !app ? 'partial' : 'complete'
  return {
    status,
    inputHash,
    title: titleValue ? claim('title', titleValue, sourceUrl, titleValue, 0.85) : null,
    providerName: providerMatch ? claim('provider_name', providerMatch[1].trim(), sourceUrl, providerMatch[0], 0.7) : null,
    description: text ? claim('description', text.slice(0, 5000), sourceUrl, text.slice(0, 500), 0.55) : null,
    applicationUrl: app ? claim('application_url', new URL(app.href, sourceUrl).toString(), sourceUrl, app.text || app.href, 0.8) : null,
    deadline: deadline ? claim('deadline', deadline.value, sourceUrl, deadline.evidence, 0.75) : null,
    amount: amountMatch ? claim('amount', amountMatch[0], sourceUrl, quote(text, amountMatch[0]), 0.7) : null,
    level: claim('level', levelValue, sourceUrl, levelEvidence, levelValue === 'unclear' ? 0.3 : 0.75),
    discipline: null,
    claims,
    contradictions,
  }
}
