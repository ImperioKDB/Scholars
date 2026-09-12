// lib/config.ts
// Every literal that appears in more than one module lives here. The
// motivating cases: REF_COOKIE_NAME was declared in middleware.ts and
// app/auth/callback/route.ts; SHARE_POINTS / MAX_SHARES_PER_DAY were
// magic numbers inside app/api/xp/share/route.ts; ADMIN_LIST_CAP was
// copy-pasted across four admin routes. One rename, one place.
export const COOKIE_NAMES = {
  REF: "ref_id",
  CONSENT: "scholars_consent",
} as const;
export const REF_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
export const DEFAULT_APP_URL = "https://scholars-eight.vercel.app";
export const XP = {
  SHARE_POINTS: 3,
  MAX_SHARES_PER_DAY: 10,
} as const;
export const ADMIN_LIST_CAP = 1000;
export const ADMIN_HEALTH_ROW_CAP = 2000;
