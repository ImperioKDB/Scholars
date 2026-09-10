import Link from "next/link";
import { Logo } from "@/components/Logo";

// app/reviews/layout.tsx
// Shared chrome for /reviews: same quiet public chrome as /about (logo +
// Get started), but a wider reading column (max-w-5xl) because reviews
// render as a two-column card grid rather than a single reading column.
export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <Link href="/" aria-label="Scholars home">
            <Logo className="text-navy" />
          </Link>
          <Link href="/signup" className="text-sm text-navy-light hover:text-navy">
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
    </div>
  );
}
