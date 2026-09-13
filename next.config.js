/** @type {import('next').NextConfig} */
// SECURITY HARDENING: baseline security headers on every response.
//   - nosniff: browsers must honor the declared Content-Type (blocks
//     MIME-confusion attacks on uploaded/OG assets).
//   - DENY framing: Scholars is never embedded in an iframe, so this
//     closes clickjacking outright.
//   - strict-origin-when-cross-origin: leak only the origin (not the full
//     URL with query params, e.g. ?ref= referral ids) to third parties.
//   - Permissions-Policy: switch off camera/mic/geolocation, none of which
//     the app uses.
//
// CSP (CSP_AUDIT.md, 2026-09-13): ENFORCING now. The report-only phase ran
// against a real 24h traffic sample with zero violations, and a static
// cross-check confirmed every browser-side resource is covered: next/font
// self-hosts fonts (font-src 'self' correct), /logo.png + public/ assets
// (img-src 'self'), avatars/testimonials/about portrait via Supabase
// Storage (img-src https://*.supabase.co), browser Supabase auth + storage
// calls (connect-src https://*.supabase.co), same-origin /api fetches
// (connect-src 'self'), inline style={{}} attributes (style-src
// 'unsafe-inline'), and App Router inline flight-data scripts (script-src
// 'unsafe-inline'). Google OAuth is a top-level navigation, not a fetch,
// so it needs no connect-src entry.
//
// /api/csp-report stays wired either way, so any regression shows up in
// Vercel Logs immediately instead of silently breaking a real user.
// REVERT PATH: rename the header key below back to
// Content-Security-Policy-Report-Only and redeploy. One line.
//
// Policy notes for this codebase:
//   - script-src needs 'unsafe-inline' because Next.js App Router embeds
//     its streaming flight data in inline <script> tags. Nonce-based
//     script-src is a deferred hardening pass (CSP_AUDIT.md gap 1).
//   - style-src needs 'unsafe-inline' because components set style={{}}
//     attributes (progress bars, seals, confetti).
//   - img-src allows the Supabase Storage host for avatars and the About
//     portrait, plus data:/blob: for canvas-downscaled uploads.
//   - connect-src only needs self + Supabase: HIBP, Gemini and Brevo calls
//     all happen server-side, never from the browser. Add
//     wss://*.supabase.co here if Realtime subscriptions are ever adopted
//     (CSP_AUDIT.md gap 2).
const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https://*.supabase.co; " +
  "font-src 'self' data:; " +
  "connect-src 'self' https://*.supabase.co; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'; " +
  "upgrade-insecure-requests; " +
  "report-uri /api/csp-report";
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
