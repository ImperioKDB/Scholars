// lib/logging.ts
//
// Structured JSON logging helper (security hardening, phase 4).
//
// WHY: production logs were scattered console.error/console.warn calls
// with free-text messages, impossible to filter in Vercel's log dashboard.
// Every call through this helper emits ONE JSON line with a stable shape
// (level, route, message, timestamp, optional error + context), so Vercel
// Logs can be searched/filtered by route or level, and a future log drain
// can parse it without heuristics.
//
// Deliberately thin: console.* IS the Vercel log transport for serverless
// functions; wrapping it (instead of shipping to a third-party APM) keeps
// this dependency-free. Sentry/Datadog-style APM is a flagged future
// option, explicitly out of scope for this MVP.
type LogContext = Record<string, unknown>

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: { name: error.name, message: error.message } }
  }
  if (error === undefined || error === null) return {}
  return { error: String(error) }
}

function emit(
  level: 'error' | 'warn',
  route: string,
  message: string,
  context?: LogContext,
  error?: unknown
) {
  const entry = {
    level,
    route,
    message,
    timestamp: new Date().toISOString(),
    ...serializeError(error),
    ...(context ?? {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else console.warn(line)
}

export function logError(route: string, message: string, context?: LogContext, error?: unknown) {
  emit('error', route, message, context, error)
}

export function logWarn(route: string, message: string, context?: LogContext, error?: unknown) {
  emit('warn', route, message, context, error)
}
