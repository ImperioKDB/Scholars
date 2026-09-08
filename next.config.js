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
// CSP (audit item): shipped as REPORT-ONLY first. Browsers evaluate the
// policy and POST a violation report to /api/csp-report (see that route)
// every time something WOULD have been blocked, but block nothing. Once
// Vercel Logs shows zero reports across a full browse pass, the header is
// flipped to Content-Security-Policy (enforcing) in a one-line change.
// Policy notes for this codebase:
//   - script-src needs 'unsafe-inline' because Next.js App Router embeds
//     its streaming flight data in inline <script> tags.
//   - style-src needs 'unsafe-inline' because components set style={{}}
//     attributes (progress bars, seals, confetti).
//   - img-src allows the Supabase Storage host for avatars and the About
//     portrait, plus data:/blob: for canvas-downscaled uploads.
//   - connect-src only needs self + Supabase: HIBP, Gemini and Brevo calls
//     all happen server-side, never from the browser.
const CSP_REPORT_ONLY =
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
          { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
