import { NextResponse } from "next/server";

type AuthErrorLike = { name?: string; status?: number } | null | undefined;

export function isTransientAuthError(error: AuthErrorLike): boolean {
  return Boolean(
    error &&
      (error.name === "AuthRetryableFetchError" ||
        error.status === undefined ||
        error.status === 0 ||
        error.status >= 500)
  );
}

export function authFailureResponse(error: AuthErrorLike): NextResponse {
  if (isTransientAuthError(error)) {
    return NextResponse.json(
      { error: "Authentication is temporarily unavailable. Check your connection and try again.", retryable: true },
      { status: 503, headers: { "Retry-After": "3", "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    { error: "Not authenticated" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
