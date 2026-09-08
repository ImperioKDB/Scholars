"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// components/CookieConsent.tsx
//
// Essential-only cookie consent banner, mounted once in the root layout so
// it covers public and authenticated pages alike. Scholars sets no
// advertising or cross-site tracking cookies, so there is nothing to
// granularly decline: the banner states plainly what the essential cookies
// do and offers a single Accept. Consent persists in localStorage; a
// missing or unparsable value re-shows the banner.
//
// Sits above the mobile tap-to-reveal tab bar (z-[96]) on purpose: until
// the student answers, consent is the most important thing on screen. Once
// accepted it disappears for good on that device.
const CONSENT_KEY = "scholars.cookie.consent";

function readConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "essential";
  } catch {
    return false;
  }
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!readConsent());
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(CONSENT_KEY, "essential");
    } catch {
      // storage blocked -- banner re-shows next visit, acceptable
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[96] bg-white border-t border-hairline shadow-[0_-2px_12px_rgba(11,30,61,0.08)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-5xl px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <p className="text-sm text-ink leading-relaxed flex-1">
          Scholars uses essential cookies only: keeping you signed in, crediting referrals, and
          saving your in-progress profile on this device. No ads, no cross-site tracking.{" "}
          <Link href="/legal/privacy" className="text-navy font-medium hover:underline">
            Privacy policy
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
