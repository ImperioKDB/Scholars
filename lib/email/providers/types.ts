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

export class EmailProviderError extends Error {
  readonly provider: EmailProvider
  readonly status: number | null
  readonly code: string | null
  readonly classification: FailureClassification

  constructor(input: {
    provider: EmailProvider
    status: number | null
    code?: string | null
    classification: FailureClassification
  }) {
    super(`Email provider request failed (${input.provider}, ${input.classification}).`)
    this.name = 'EmailProviderError'
    this.provider = input.provider
    this.status = input.status
    this.code = input.code ?? null
    this.classification = input.classification
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
    }
  }
  return { provider: 'unknown', classification: 'uncertain_outcome', status: null, code: 'unclassified_error' }
}
