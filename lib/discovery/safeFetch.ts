import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createHash } from 'node:crypto'

export type SafeFetchPolicy = {
  allowedHosts: string[]
  maxRedirects?: number
  maxBytes?: number
  timeoutMs?: number
  allowedContentTypes?: string[]
  policyVersion?: string
}

export type SafeFetchResult = {
  requestedUrl: string
  finalUrl: string | null
  redirectChain: string[]
  httpStatus: number | null
  contentType: string | null
  byteLength: number | null
  contentHash: string | null
  body: string | null
  fetchedAt: string
  status: 'ok' | 'blocked' | 'unreachable' | 'too_large' | 'unsupported' | 'error'
  errorCode: string | null
  notes: string | null
}

const DEFAULT_CONTENT_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain']

function hostnameMatches(hostname: string, allowedHosts: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return allowedHosts.some((allowed) => {
    const value = allowed.toLowerCase().replace(/^\*\./, '').replace(/\.$/, '')
    return host === value || host.endsWith(`.${value}`)
  })
}

function privateIpv4(value: string): boolean {
  const parts = value.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)) || a >= 224
}

function privateIpv6(value: string): boolean {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('ff') || normalized.startsWith('2001:db8:') || normalized.startsWith('2001:2:')) return true
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return Boolean(mapped && privateIpv4(mapped[1]))
}

export function isUnsafeAddress(value: string): boolean {
  const kind = isIP(value)
  return kind === 4 ? privateIpv4(value) : kind === 6 ? privateIpv6(value) : true
}

export function validateFetchUrl(rawUrl: string, allowedHosts: string[]): URL {
  let url: URL
  try { url = new URL(rawUrl) } catch { throw new Error('invalid_url') }
  if (url.protocol !== 'https:') throw new Error('https_required')
  if (url.username || url.password || url.port && url.port !== '443') throw new Error('unsafe_url_credentials_or_port')
  if (!url.hostname || isIP(url.hostname) || !hostnameMatches(url.hostname, allowedHosts)) throw new Error('host_not_allowed')
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) throw new Error('private_host')
  return url
}

async function assertSafeResolution(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isUnsafeAddress(hostname)) throw new Error('private_address')
    return
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some((entry) => isUnsafeAddress(entry.address))) throw new Error('private_address')
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<{ text: string; bytes: number } | null> {
  if (!response.body) return { text: '', bytes: 0 }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const merged = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return { text: new TextDecoder().decode(merged), bytes }
}

export async function safeFetch(rawUrl: string, policy: SafeFetchPolicy): Promise<SafeFetchResult> {
  const fetchedAt = new Date().toISOString()
  const maxRedirects = policy.maxRedirects ?? 5
  const maxBytes = policy.maxBytes ?? 1_500_000
  const timeoutMs = policy.timeoutMs ?? 12_000
  const allowedContentTypes = policy.allowedContentTypes ?? DEFAULT_CONTENT_TYPES
  const redirectChain: string[] = []
  let current = rawUrl
  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const url = validateFetchUrl(current, policy.allowedHosts)
      await assertSafeResolution(url.hostname)
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'ScholarsBot/1.0 (+https://scholars.com.ng)', accept: allowedContentTypes.join(', ') } })
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? null
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location || redirects === maxRedirects) return { requestedUrl: rawUrl, finalUrl: url.toString(), redirectChain, httpStatus: response.status, contentType, byteLength: null, contentHash: null, body: null, fetchedAt, status: 'blocked', errorCode: 'redirect_limit_or_missing_location', notes: 'Redirect chain exceeded policy or omitted a location.' }
        const next = new URL(location, url).toString()
        redirectChain.push(next)
        current = next
        continue
      }
      if (response.status < 200 || response.status >= 300) return { requestedUrl: rawUrl, finalUrl: url.toString(), redirectChain, httpStatus: response.status, contentType, byteLength: null, contentHash: null, body: null, fetchedAt, status: 'unreachable', errorCode: `http_${response.status}`, notes: `Source returned HTTP ${response.status}.` }
      if (!contentType || !allowedContentTypes.some((allowed) => contentType === allowed || contentType.startsWith(`${allowed};`))) return { requestedUrl: rawUrl, finalUrl: url.toString(), redirectChain, httpStatus: response.status, contentType, byteLength: null, contentHash: null, body: null, fetchedAt, status: 'unsupported', errorCode: 'content_type_not_allowed', notes: `Content type ${contentType ?? 'unknown'} is not allowed.` }
      const body = await readBoundedBody(response, maxBytes)
      if (!body) return { requestedUrl: rawUrl, finalUrl: url.toString(), redirectChain, httpStatus: response.status, contentType, byteLength: maxBytes, contentHash: null, body: null, fetchedAt, status: 'too_large', errorCode: 'response_too_large', notes: `Response exceeded ${maxBytes} bytes.` }
      return { requestedUrl: rawUrl, finalUrl: url.toString(), redirectChain, httpStatus: response.status, contentType, byteLength: body.bytes, contentHash: createHash('sha256').update(body.text).digest('hex'), body: body.text, fetchedAt, status: 'ok', errorCode: null, notes: redirectChain.length ? 'Fetched after validated redirects.' : null }
    }
    throw new Error('redirect_limit')
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : 'fetch_failed'
    const status = ['invalid_url', 'https_required', 'unsafe_url_credentials_or_port', 'host_not_allowed', 'private_host', 'private_address'].includes(errorCode) ? 'blocked' : 'unreachable'
    return { requestedUrl: rawUrl, finalUrl: null, redirectChain, httpStatus: null, contentType: null, byteLength: null, contentHash: null, body: null, fetchedAt, status, errorCode, notes: error instanceof Error ? error.message : 'Fetch failed.' }
  }
}
