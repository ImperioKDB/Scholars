/**
 * Safe push-delivery diagnostics.
 *
 * Never return or log arbitrary provider/database error messages.
 * Error names and codes are retained only when explicitly allowlisted.
 */

export type SafePushErrorDiagnostic = {
  errorName: string
  errorCode: string | null
}

const SAFE_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'AbortError',
  'TimeoutError',
  'FetchError',
  'PostgrestError',
  'FunctionsFetchError',
  'AuthError',
  'StorageError',
  'RealtimeError',
])

const SAFE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  '23502',
  '23503',
  '23505',
  '42501',
  'PGRST116',
])

function readStringProperty(
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

export function getSafePushErrorDiagnostic(
  error: unknown,
): SafePushErrorDiagnostic {
  let current: unknown = error
  const visited = new Set<object>()

  let safeName: string | null = null
  let safeCode: string | null = null

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== 'object' || current === null) break
    if (visited.has(current)) break
    visited.add(current)

    const rawName = readStringProperty(current, 'name')
    const rawCode = readStringProperty(current, 'code')

    if (!safeName && rawName && SAFE_ERROR_NAMES.has(rawName)) {
      safeName = rawName
    }
    if (!safeCode && rawCode && SAFE_ERROR_CODES.has(rawCode)) {
      safeCode = rawCode
    }

    try {
      current = (current as Record<string, unknown>).cause
    } catch {
      break
    }
  }

  return {
    errorName: safeName ?? 'UnknownError',
    errorCode: safeCode,
  }
}

/**
 * HTTP status codes are useful operational diagnostics.
 * Accept only integer HTTP status codes in the standard range.
 */
export function getSafeHttpStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null

  try {
    const value = (error as Record<string, unknown>).statusCode
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 100 &&
      value <= 599
      ? value
      : null
  } catch {
    return null
  }
}
