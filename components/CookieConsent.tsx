"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// components/CookieConsent.tsx
// Consent notice presented as a compact, non-blocking panel. The product and
// its primary CTA stay usable while the visitor makes this low-risk choice.
//
// Semantics, stated honestly in the copy:
//   Accept  -> record "essential"; allow referral credit; never ask again.
//   Reject  -> record "rejected"; middleware skips setting the referral
//              cookie for this browser; never ask again. Sign-in cookies
//              stay on either way because the app cannot work without them.
// A mirror cookie (scholars_consent) is written so middleware.ts, which
// runs server-side and cannot read localStorage, can honor the choice.
const CONSENT_KEY = "scholars.cookie.consent";
const CONSENT_COOKIE = "scholars_consent";
const YEAR_SECONDS = 365 * 24 * 60 * 60;

function readConsent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function setConsentCookie(value: string) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${YEAR_SECONDS}; samesite=lax${secure}`;
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(readConsent() === null);
  }, []);

  const record = useCallback((choice: "essential" | "rejected") => {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // storage blocked -- choice won't persist; acceptable
    }
    setConsentCookie(choice);
    setShow(false);
  }, []);

  if (!show) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[97] p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:w-[min(100%-1.5rem,28rem)] sm:p-0"
      role="region"
      aria-label="Cookie preferences"
      aria-live="polite"
    >
      <div
        className="bg-white rounded-2xl border border-hairline shadow-card p-5"
      >
        <h2 id="cookie-title" className="font-display text-xl font-semibold text-navy mb-2">
          Cookies on Scholars
        </h2>
        <p id="cookie-description" className="text-sm text-ink leading-relaxed mb-5">
          We use essential cookies only: keeping you signed in and crediting referral links. No
          advertising, no cross-site tracking.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => record("essential")}
            className="flex-1 rounded-seal bg-navy text-white text-sm font-medium px-6 py-3 hover:bg-navy-light transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => record("rejected")}
            className="flex-1 rounded-seal border border-hairline text-navy-light text-sm font-medium px-6 py-3 hover:border-navy/40 hover:text-navy transition-colors"
          >
            Reject
          </button>
        </div>
        <p id="cookie-details" className="text-xs text-navy-light mt-4 leading-relaxed">
          Rejecting turns off referral credit from this browser. Either way, sign-in cookies stay on
          because the app can&apos;t work without them.{" "}
          <Link href="/legal/privacy" className="text-navy font-medium hover:underline">
            Privacy policy
          </Link>
        </p>
      </div>
    </div>
  );
}
