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
//   - CSP REPORT-ONLY (batch 2): shipped as Report-Only first so a
//     mis-allowed source can never break the live site. Violations surface
//     in browser consoles (and any future report-to endpoint) so the
//     policy can be tightened to an enforcing Content-Security-Policy in a
//     later batch once it is observed clean. connect-src covers the
//     Supabase project host the browser client talks to; img-src covers
//     avatar/portrait objects served from Supabase Storage plus data:/blob:
//     for the client-side canvas downscale path.
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
          {
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
