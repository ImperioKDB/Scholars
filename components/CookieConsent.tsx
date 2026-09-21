"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOverlayAccessibility } from "@/lib/useOverlayAccessibility";

// components/CookieConsent.tsx
// Consent dialog presented as a compact bottom sheet on mobile and centered
// panel on larger screens. The backdrop dims without blurring the product,
// keeping the visual weight proportional to this low-risk choice.
//
// Semantics, stated honestly in the copy:
//   Accept  -> record "essential"; allow referral credit; never ask again.
//   Reject  -> record "rejected"; middleware skips setting the referral
//              cookie for this browser; never ask again. Sign-in cookies
//              stay on either way because the app cannot work without them.
//   Escape  -> treated as Reject.
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

  const closeDialog = useCallback(() => record("rejected"), [record]);
  const dialogRef = useOverlayAccessibility(show, closeDialog);

  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[97] flex items-end justify-center p-4 sm:items-center bg-navy/20"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl border border-hairline shadow-card p-6 max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-title"
        aria-describedby="cookie-description cookie-details"
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
