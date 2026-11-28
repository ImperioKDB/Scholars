/** Keep each broadcast event below this ceiling, including failed requests and queue bindings. */
export const BROADCAST_OPERATION_LIMIT = 32

export class BroadcastBudget {
  used = 0

  constructor(
    private readonly limit = BROADCAST_OPERATION_LIMIT,
    private readonly transport: typeof fetch = fetch,
  ) {}

  require(operations: number) {
    if (this.used + operations > this.limit) throw new Error('broadcast_budget_exhausted')
  }

  operation<T>(run: () => Promise<T>): Promise<T> {
    this.require(1)
    this.used += 1
    return run()
  }

  fetch: typeof fetch = (input, init) => this.operation(() => {
    const timeout = AbortSignal.timeout(4_000)
    const signal = init?.signal ?? (input instanceof Request ? input.signal : null)
    const transport = this.transport
    return transport(input, {
      ...init,
      redirect: 'manual',
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    })
  })
}

export async function readBoundedJson<T>(source: Request | Response, limit = 32_768): Promise<T> {
  const reader = source.body?.getReader()
  if (!reader) throw new Error('broadcast_empty_body')
  const decoder = new TextDecoder()
  let size = 0
  let body = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return JSON.parse(body + decoder.decode()) as T
      size += value.byteLength
      if (size > limit) throw new Error('broadcast_body_too_large')
      body += decoder.decode(value, { stream: true })
    }
  } finally {
    // A provider or caller can leave its response open after exceeding the size limit.
    void reader.cancel().catch(() => {})
  }
}

export type BroadcastDatabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

export class BroadcastDatabaseError extends Error {
  constructor(readonly status: number, readonly code: string | undefined) {
    super('broadcast_database_error')
  }
}

export function broadcastDatabase(env: BroadcastDatabaseEnv, budget: BroadcastBudget) {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = env
  if (!url || !key) throw new Error('broadcast_database_not_configured')
  return async function rpc<T>(name: string, arguments_: Record<string, unknown> = {}): Promise<T> {
    const response = await budget.fetch(new URL('/rest/v1/rpc/' + name, url), {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(arguments_),
    })
    if (!response.ok) {
      const diagnostic = await readBoundedJson<{ code?: string }>(response, 4096).catch(() => null)
      throw new BroadcastDatabaseError(response.status, diagnostic?.code)
    }
    return readBoundedJson<T>(response)
  }
}
