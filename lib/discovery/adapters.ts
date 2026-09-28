import { extractScholarship, type ExtractionResult } from './extraction'

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
    key: 'provider-generic',
    version: 'provider-generic-v1',
    hosts: ['mtn.ng', 'www.mtn.ng'],
    extract: (html, sourceUrl) => extractScholarship(html, sourceUrl),
  },
]

const fallback: SourceAdapter = { key: 'generic-fallback', version: 'generic-fallback-v1', hosts: [], extract: (html, sourceUrl) => extractScholarship(html, sourceUrl) }

export function adapterForUrl(sourceUrl: string): SourceAdapter {
  let hostname = ''
  try { hostname = new URL(sourceUrl).hostname.toLowerCase() } catch { return fallback }
  return adapters.find((adapter) => adapter.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) ?? fallback
}

export function extractWithAdapter(html: string, sourceUrl: string): { adapter: SourceAdapter; result: ExtractionResult } {
  const adapter = adapterForUrl(sourceUrl)
  return { adapter, result: adapter.extract(html, sourceUrl) }
}
