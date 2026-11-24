export type EmailProvider = 'brevo' | 'resend'
export type FailureClassification = 'definitive_rejection' | 'uncertain_outcome'

export type ProviderSendInput = {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey?: string
}

export type ProviderSendResult = {
  provider: EmailProvider
  messageId: string | null
}

export type SafeNetworkErrorDiagnostic = {
  networkErrorName: string | null
  networkErrorCode: string | null
}

const SAFE_NETWORK_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'AbortError',
  'TimeoutError',
  'FetchError',
  'ConnectTimeoutError',
  'SocketError',
  'HeadersTimeoutError',
  'BodyTimeoutError',
])

const SAFE_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_RESPONSE_STATUS_CODE',
])

function readSafeStringProperty(
  value: object,
  property: string,
): string | null {
  try {
    const candidate = (value as Record<string, unknown>)[property]
    return typeof candidate === 'string' ? candidate : null
  } catch {
    return null
  }
}

/**
 * Extract only explicitly allowlisted error names and codes.
 * Never read or return error messages, request URLs, headers, or payloads.
 * Nested causes are inspected to expose safe runtime/network diagnostics.
 */
export function getSafeNetworkErrorDiagnostic(
  error: unknown,
): SafeNetworkErrorDiagnostic {
  let current: unknown = error
  const visited = new Set<object>()

  let safeName: string | null = null
  let safeCode: string | null = null

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== 'object' || current === null) break
    if (visited.has(current)) break
    visited.add(current)

    const name = readSafeStringProperty(current, 'name')
    const code = readSafeStringProperty(current, 'code')

    if (!safeName && name && SAFE_NETWORK_ERROR_NAMES.has(name)) {
      safeName = name
    }
    if (!safeCode && code && SAFE_NETWORK_ERROR_CODES.has(code)) {
      safeCode = code
    }

    try {
      current = (current as Record<string, unknown>).cause
    } catch {
      break
    }
  }

  return {
    networkErrorName: safeName,
    networkErrorCode: safeCode,
  }
}

export class EmailProviderError extends Error {
  readonly provider: EmailProvider
  readonly status: number | null
  readonly code: string | null
  readonly classification: FailureClassification
  readonly networkErrorName: string | null
  readonly networkErrorCode: string | null

  constructor(input: {
    provider: EmailProvider
    status: number | null
    code?: string | null
    classification: FailureClassification
    networkError?: unknown
  }) {
    super(`Email provider request failed (${input.provider}, ${input.classification}).`)
    this.name = 'EmailProviderError'
    this.provider = input.provider
    this.status = input.status
    this.code = input.code ?? null
    this.classification = input.classification

    const network = getSafeNetworkErrorDiagnostic(input.networkError)
    this.networkErrorName = network.networkErrorName
    this.networkErrorCode = network.networkErrorCode
  }
}

const SAFE_CODE = /^[a-zA-Z0-9_.:-]{1,100}$/

export function safeProviderCode(value: unknown): string | null {
  return typeof value === 'string' && SAFE_CODE.test(value) ? value : null
}

export async function readProviderErrorCode(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.clone().json()
    if (!payload || typeof payload !== 'object') return null
    const body = payload as Record<string, unknown>
    const direct = safeProviderCode(body.code)
    if (direct) return direct
    if (typeof body.error === 'string') return safeProviderCode(body.error)
    if (body.error && typeof body.error === 'object') {
      const nested = safeProviderCode((body.error as Record<string, unknown>).code)
      if (nested) return nested
    }
  } catch {
    // Provider bodies are deliberately never included in errors or logs.
  }
  return null
}

export function classifyBrevoStatus(status: number): FailureClassification {
  if ([400, 401, 402, 403, 404, 405, 406, 422, 429].includes(status)) {
    return 'definitive_rejection'
  }
  return 'uncertain_outcome'
}

export function classifyResendStatus(status: number): FailureClassification {
  if ([400, 401, 403, 404, 422].includes(status)) return 'definitive_rejection'
  // 409, 408, 429 and server/unknown statuses remain conservative/uncertain.
  return 'uncertain_outcome'
}

export function isUncertainEmailError(error: unknown): boolean {
  return error instanceof EmailProviderError && error.classification === 'uncertain_outcome'
}

export function safeEmailErrorDiagnostic(error: unknown): Record<string, string | number | null> {
  if (error instanceof EmailProviderError) {
    return {
      provider: error.provider,
      classification: error.classification,
      status: error.status,
      code: error.code,
      networkErrorName: error.networkErrorName,
      networkErrorCode: error.networkErrorCode,
    }
  }

  const network = getSafeNetworkErrorDiagnostic(error)
  return {
    provider: 'unknown',
    classification: 'uncertain_outcome',
    status: null,
    code: 'unclassified_error',
    networkErrorName: network.networkErrorName,
    networkErrorCode: network.networkErrorCode,
  }
}
