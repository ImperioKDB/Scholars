// lib/errors.ts
// Sanitize database errors before they reach a client. Raw PostgREST /
// Postgres messages leak schema details (table names, column names,
// constraint names) to end users, which is an information-disclosure
// footgun. Routes log the FULL error server-side (lib/logging.ts) and
// return a stable, friendly sentence plus the stable SQLSTATE code so
// support can correlate without exposing internals.
import { NextResponse } from "next/server";
import { logError } from "@/lib/logging";
export function dbErrorResponse(
  route: string,
  error: { code?: string; message?: string },
  fallback = "Something went wrong on our side. Please try again."
) {
  logError(route, "db_error", { code: error.code }, error);
  return NextResponse.json({ error: fallback, code: error.code }, { status: 500 });
}
