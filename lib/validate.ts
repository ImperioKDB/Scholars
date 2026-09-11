// lib/validate.ts
//
// Shared input-hardening helpers. Every place user input enters the system
// (API bodies, query params, path params, cookies, headers) passes through
// one of these before it touches the database, an email, or a redirect.
//
// Threat-model notes for this codebase:
//   - SQL injection: all DB access goes through supabase-js/PostgREST,
//     which parameterizes values, so classic SQLi is not reachable. The
//     real injection surfaces are PostgREST filter syntax (.or() strings,
//     ILIKE wildcards) and jsonb rule values -- handled below.
//   - Command injection: this codebase never spawns processes (no
//     child_process/exec/spawn anywhere). Nothing to harden; verified.
//   - Script injection: React escapes renders; the remaining vectors are
//     stored URLs rendered in href / window.open / img-src contexts
//     (application_url, avatar_url, photo_url). Every stored URL is now
//     restricted to http(s), and avatar/photo URLs are pinned to our own
//     Supabase Storage host.
//   - Open redirect: auth callback `next` is whitelisted to same-origin
//     relative paths only (safeNextPath).
import { z } from "zod";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Regex-based (rather than z.string().uuid()) so behavior is identical
// regardless of the exact zod version resolved.
export const uuidSchema = z.string().regex(UUID_RE, "Invalid id");

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Drop-in replacement for z.string().url() anywhere the value is rendered
// in an href / window.open context. z.string().url() accepts javascript:,
// data:, file:, vbscript: -- stored-XSS payloads waiting for a click.
export const httpUrlSchema = z
  .string()
  .refine(isHttpUrl, "Must be a full URL starting with http(s)://");

// Strictest URL check: must be an https object inside one of our own
// Supabase Storage public buckets. Used for avatar_url / testimonial
// photo_url so a client can never point a rendered <img> at an
// attacker-controlled host, even though the image bytes themselves go
// straight to Storage and are already RLS-scoped.
export function isOwnStorageUrl(
  value: string,
  bucket: "avatars" | "site"
): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    if (base) {
      const b = new URL(base);
      if (u.hostname !== b.hostname) return false;
    }
    return u.pathname.startsWith(`/storage/v1/object/public/${bucket}/`);
  } catch {
    return false;
  }
}

// Escape ILIKE wildcards (%, _, \) so user text matches literally instead
// of as a pattern. Stops wildcard abuse in .ilike() filters.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => "\\" + ch);
}

// Free-text search destined for a PostgREST .or("col.ilike.%X%,...")
// fragment. Two stages:
//   1. Strip PostgREST structural characters: comma splits or-conditions,
//      parens group them, double-quote starts a quoted value, backslash
//      escapes them. Removing these means the value can never break out
//      of its %...% wrapper.
//   2. Escape ILIKE wildcards so the remaining text is literal.
export function sanitizeSearchText(raw: string): string {
  return escapeLikePattern(raw.replace(/[%,()"\\]/g, " ").trim());
}

// Safe target for ?next= style redirect params. Only same-origin relative
// paths pass; absolute URLs, protocol-relative (//evil.com), backslash
// tricks (/\evil.com normalizes to //evil.com in some browsers) and
// control characters all fall back.
export function safeNextPath(
  next: string | null | undefined,
  fallback: string
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

// Minimal HTML escaping for email composition (table-based Brevo emails
// cannot rely on a templating engine). Covers every interpolation point.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
