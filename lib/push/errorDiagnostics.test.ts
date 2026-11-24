import { describe, expect, it } from 'vitest'
import {
  getSafePushErrorDiagnostic,
  getSafeHttpStatusCode,
} from './errorDiagnostics'

describe('getSafePushErrorDiagnostic', () => {
  it('returns a safe fallback for null and primitive errors', () => {
    expect(getSafePushErrorDiagnostic(null)).toEqual({
      errorName: 'UnknownError',
      errorCode: null,
    })

    expect(getSafePushErrorDiagnostic('secret token value')).toEqual({
      errorName: 'UnknownError',
      errorCode: null,
    })
  })

  it('preserves recognized error names and approved codes', () => {
    const error = Object.assign(new TypeError('private message'), {
      code: 'ECONNRESET',
    })

    expect(getSafePushErrorDiagnostic(error)).toEqual({
      errorName: 'TypeError',
      errorCode: 'ECONNRESET',
    })
  })

  it('rejects unrecognized error names and codes', () => {
    const error = Object.assign(new Error('private message'), {
      name: 'ProviderCredentialError',
      code: 'token=secret-value',
    })

    expect(getSafePushErrorDiagnostic(error)).toEqual({
      errorName: 'UnknownError',
      errorCode: null,
    })
  })

  it('does not expose arbitrary error messages', () => {
    const secret = 'ExponentPushToken[private-secret]'
    const error = Object.assign(new Error(secret), {
      code: 'ECONNRESET',
    })

    const diagnostic = getSafePushErrorDiagnostic(error)

    expect(JSON.stringify(diagnostic)).not.toContain(secret)
    expect(diagnostic).not.toHaveProperty('errorMessage')
    expect(diagnostic).not.toHaveProperty('message')
  })

  it('does not read the message property', () => {
    const error = {
      name: 'Error',
      code: 'ETIMEDOUT',
      get message() {
        throw new Error('message must not be accessed')
      },
    }

    expect(getSafePushErrorDiagnostic(error)).toEqual({
      errorName: 'Error',
      errorCode: 'ETIMEDOUT',
    })
  })

  it('handles throwing property access safely', () => {
    const error = new Proxy({}, {
      get() {
        throw new Error('private provider data')
      },
    })

    expect(getSafePushErrorDiagnostic(error)).toEqual({
      errorName: 'UnknownError',
      errorCode: null,
    })
  })

  it('does not accept syntactically valid but unapproved codes', () => {
    const error = Object.assign(new Error('failure'), {
      code: 'VALID_BUT_UNAPPROVED',
    })

    expect(getSafePushErrorDiagnostic(error).errorCode).toBeNull()
  })
})

describe('getSafeHttpStatusCode', () => {
  it('preserves valid HTTP status codes', () => {
    expect(getSafeHttpStatusCode({ statusCode: 410 })).toBe(410)
    expect(getSafeHttpStatusCode({ statusCode: 401 })).toBe(401)
  })

  it('rejects invalid status codes', () => {
    expect(getSafeHttpStatusCode({ statusCode: '401' })).toBeNull()
    expect(getSafeHttpStatusCode({ statusCode: 999 })).toBeNull()
    expect(getSafeHttpStatusCode({ statusCode: 0 })).toBeNull()
    expect(getSafeHttpStatusCode({ statusCode: 401.5 })).toBeNull()
    expect(getSafeHttpStatusCode(null)).toBeNull()
  })
})
