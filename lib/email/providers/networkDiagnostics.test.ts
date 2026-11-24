import { describe, expect, it } from 'vitest'
import {
  EmailProviderError,
  getSafeNetworkErrorDiagnostic,
  safeEmailErrorDiagnostic,
} from './types'

describe('safe provider network diagnostics', () => {
  it('retains allowlisted network error names and codes', () => {
    const error = Object.assign(new TypeError('private message'), {
      code: 'ECONNRESET',
    })

    expect(getSafeNetworkErrorDiagnostic(error)).toEqual({
      networkErrorName: 'TypeError',
      networkErrorCode: 'ECONNRESET',
    })
  })

  it('reads allowlisted values from a nested cause', () => {
    const error = new Error('outer private message', {
      cause: Object.assign(new Error('inner private message'), {
        code: 'ETIMEDOUT',
      }),
    })

    expect(getSafeNetworkErrorDiagnostic(error)).toEqual({
      networkErrorName: 'Error',
      networkErrorCode: 'ETIMEDOUT',
    })
  })

  it('does not expose arbitrary names, codes, or messages', () => {
    const error = Object.assign(new Error('secret endpoint and credentials'), {
      code: 'PRIVATE_TOKEN_VALUE',
    })

    const diagnostic = getSafeNetworkErrorDiagnostic(error)

    expect(diagnostic).toEqual({
      networkErrorName: 'Error',
      networkErrorCode: null,
    })
    expect(JSON.stringify(diagnostic)).not.toContain('secret')
    expect(JSON.stringify(diagnostic)).not.toContain('PRIVATE_TOKEN_VALUE')
  })

  it('handles cyclic causes safely', () => {
    const error: Record<string, unknown> = {
      name: 'TypeError',
      code: 'ECONNRESET',
    }
    error.cause = error

    expect(getSafeNetworkErrorDiagnostic(error)).toEqual({
      networkErrorName: 'TypeError',
      networkErrorCode: 'ECONNRESET',
    })
  })

  it('stores only safe network diagnostics on EmailProviderError', () => {
    const error = new EmailProviderError({
      provider: 'brevo',
      status: null,
      code: 'network_error',
      classification: 'uncertain_outcome',
      networkError: Object.assign(new TypeError('do not expose this'), {
        code: 'UND_ERR_SOCKET',
      }),
    })

    expect(safeEmailErrorDiagnostic(error)).toEqual({
      provider: 'brevo',
      classification: 'uncertain_outcome',
      status: null,
      code: 'network_error',
      networkErrorName: 'TypeError',
      networkErrorCode: 'UND_ERR_SOCKET',
    })
  })

  it('does not throw when error properties have throwing getters', () => {
    const error = Object.defineProperty({}, 'name', {
      get() {
        throw new Error('private getter failure')
      },
    })

    expect(getSafeNetworkErrorDiagnostic(error)).toEqual({
      networkErrorName: null,
      networkErrorCode: null,
    })
  })
})
