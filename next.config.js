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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
