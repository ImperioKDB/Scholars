"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// components/CookieConsent.tsx
//
// Essential-only cookie consent banner, mounted in the root layout.
// Scholars uses only cookies that are strictly necessary to run the app:
//   - Supabase auth session cookie (keeps the student signed in)
//   - A short-lived referral attribution cookie (only set if the student
//     arrived via someone's share link, so the referrer gets credit)
//   - Onboarding-draft localStorage (never leaves the device)
// We do not run analytics, advertising, or cross-site tracking. The banner
// reflects that honestly: one Accept button, no granular toggles to
// fiddle with, and a link to the privacy policy for anyone who wants the
// detail.
//
// Consent is stored in localStorage under CONSENT_KEY with a 1-year
// expiry encoded in the value ("essential:<expiry-ms>"). A missing key,
// an expired value, or a tampered value all re-show the banner.
const CONSENT_KEY = "scholars.cookie_consent";
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function readConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    if (!raw.startsWith("essential:")) return false;
    const expiry = Number(raw.slice("essential:".length));
    if (!Number.isFinite(expiry)) return false;
    return expiry > Date.now();
  } catch {
    return false;
  }
}

function writeConsent() {
  try {
    window.localStorage.setItem(
      CONSENT_KEY,
      "essential:" + String(Date.now() + CONSENT_TTL_MS)
    );
  } catch {
    // storage blocked -- degrade to showing the banner next load
  }
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!readConsent());
  }, []);

  if (!show) return null;

  function accept() {
    writeConsent();
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[95] bg-white border-t border-hairline shadow-[0_-2px_12px_rgba(11,30,61,0.08)]"
    >
      <div className="mx-auto max-w-5xl px-5 py-4 md:py-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <p className="text-sm text-ink leading-relaxed flex-1">
          Scholars uses only essential cookies to keep you signed in and save
          your in-progress profile. We don&apos;t track you across the web or serve ads.{" "}
          <Link href="/legal/privacy" className="text-navy font-medium hover:underline">
            Privacy policy
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={accept}
            className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2 hover:bg-navy-light transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
