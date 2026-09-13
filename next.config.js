/** @type {import('next').NextConfig} */
// SECURITY HARDENING (CSP enforcement, per CSP_AUDIT.md 2026-09-13):
// header flipped from Content-Security-Policy-Report-Only to enforcing.
// The audit found zero violations across a real 24h traffic sample plus a
// full static cross-check of every browser-side resource, so enforcing is
// safe. /api/csp-report stays wired via report-uri, and report-to is added
// for redundancy in case browsers drop report-uri. Trivially revertible:
// rename the header key back to Content-Security-Policy-Report-Only.
//
// Policy notes (unchanged from the report-only version):
//   - script-src 'unsafe-inline' is required by App Router inline flight
//     data; nonce hardening is a deferred pass (audit Gap 1).
//   - connect-src has no wss:// because nothing uses Supabase Realtime
//     yet; add wss://*.supabase.co if Realtime is adopted (audit Gap 2).
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
  "report-uri /api/csp-report; " +
  "report-to csp-endpoint";
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
          {
            key: 'Reporting-Endpoints',
            value: 'csp-endpoint="/api/csp-report"',
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
