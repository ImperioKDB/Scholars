import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/Logo";

// Modeled on the "large-type footer" pattern: brand + real nav links up top,
// then an oversized wordmark as the closing visual instead of a thin
// copyright line fading out.
//
// Deliberately different from the reference in two places:
// - No newsletter email box -- we don't have that backend, and a form that
//   doesn't actually do anything is worse than not having one.
// - No "Collections"/social column -- those don't map to any real page or
//   account we have today. Only links to routes that actually exist
//   (Home, the how-it-works anchor, Log in) so nothing here is a dead link.
export function Footer() {
  return (
    <footer className="border-t border-hairline bg-white overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-14 grid md:grid-cols-3 gap-10">
        <div>
          <Logo className="text-navy mb-4" />
          <p className="text-sm text-navy-light max-w-xs leading-relaxed">
            The operating system for scholarships — matched to what you can
            actually win.
          </p>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-navy-light mb-4">
            Product
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/" className="text-navy-light hover:text-navy">
                Home
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="text-navy-light hover:text-navy">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-navy-light hover:text-navy">
                Log in
              </Link>
            </li>
          </ul>
        </div>

        <div className="bg-navy-50 rounded-xl p-5">
          <p className="font-display text-base font-semibold text-navy mb-1.5">
            Ready to find your matches?
          </p>
          <p className="text-sm text-navy-light mb-4">Free to join, takes about 5 minutes.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors"
          >
            Build your profile
          </Link>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between text-xs text-navy-light">
          <p>&copy; {new Date().getFullYear()} Scholars</p>
          <p>Made for students in Nigeria</p>
        </div>
      </div>

      {/* the large-type signature: an oversized wordmark closing the page,
          centered so it can never bleed off just one edge on narrow screens */}
      <div className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-8 md:py-10 flex items-center justify-center gap-3 md:gap-6">
          <Image
            src="/logo.png"
            alt=""
            width={80}
            height={80}
            className="w-12 h-12 md:w-20 md:h-20 shrink-0"
          />
          <span
            className="font-display font-semibold text-navy leading-none whitespace-nowrap"
            style={{ fontSize: "clamp(1.75rem, 13vw, 8rem)" }}
          >
            Scholars
          </span>
        </div>
      </div>
    </footer>
  );
}
