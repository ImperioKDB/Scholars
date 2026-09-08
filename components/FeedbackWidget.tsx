"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// components/FeedbackWidget.tsx
//
// Modal-only feedback form. The trigger lives in the Sidebar account block
// (above Log out) on both desktop and the mobile drawer, so there is no
// floating pill competing with Ade for the bottom corners of the screen.
//
// One modal, four categories, one message field, optional reply email
// pre-filled from the signed-in account. Submits to POST /api/feedback,
// which stores the row and emails the support inbox. Success and failure
// both render inline in the modal; nothing here navigates or blocks the
// page behind it.
type Category = "bug" | "feature" | "scholarship" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bug", label: "Something is broken" },
  { value: "feature", label: "Feature request" },
  { value: "scholarship", label: "Scholarship issue" },
  { value: "other", label: "Other" },
];

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = createClient();
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Reset per open so a re-open never shows a stale success or error,
  // and pre-fill the reply address lazily from the signed-in account.
  useEffect(() => {
    if (!open) return;
    setSent(false);
    setError(null);
    messageRef.current?.focus();
    if (!email) {
      (async () => {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email) setEmail(data.user.email);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, contact_email: email || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't send feedback. Try again.");
        return;
      }
      setSent(true);
      setMessage("");
      setTimeout(() => onClose(), 1800);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 bg-navy/40"
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback to Scholars"
    >
      <div className="bg-white rounded-2xl border border-hairline shadow-card p-6 max-w-sm w-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy">Send feedback</h2>
            <p className="text-xs text-navy-light mt-0.5">
              Bugs, ideas, or a scholarship that looks wrong. We read every message.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-navy-light hover:text-navy p-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {sent ? (
          <div className="rounded-xl bg-emerald-light border border-emerald/20 p-5 text-center">
            <p className="text-sm font-medium text-emerald">Thanks, we got it.</p>
            <p className="text-xs text-navy-light mt-1">
              We&apos;ll reply by email if you left an address.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">What is this about?</span>
              <select
                className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink focus:border-navy outline-none transition-colors"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                disabled={submitting}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">Your message</span>
              <textarea
                ref={messageRef}
                className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink resize-y min-h-[120px] focus:border-navy outline-none transition-colors"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened, what you expected, and where you saw it."
                maxLength={2000}
                disabled={submitting}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink mb-1.5">
                Email for a reply <span className="text-navy-light font-normal">(optional)</span>
              </span>
              <input
                type="email"
                className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink focus:border-navy outline-none transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu.ng"
                disabled={submitting}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-rose">
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="text-sm font-medium text-navy-light hover:text-navy px-3 py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || message.trim().length < 10}
                className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
              >
                {submitting ? "Sending\u2026" : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
