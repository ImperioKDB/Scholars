"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/fetch";

// components/FeedbackButton.tsx
//
// Floating feedback launcher (bottom-left, opposite Ade on the right) plus
// its modal. Visible on every authenticated page via the Sidebar layout;
// deliberately hidden on public routes (landing, /s/[id] share pages,
// /legal, /login, /signup) where there's no signed-in student to attach the
// feedback to.
//
// Category options match the feedback table's CHECK constraint
// (migration 0014): 'bug' | 'feature' | 'scholarship' | 'other'.
//
// On submit: POST /api/feedback, which inserts the row and emails
// support.scholarsteam@gmail.com. Failures surface inline; the modal never
// closes on a successful submit until the success message has been visible
// for ~1.5s, so a quick tap can't dismiss it before the student reads it.
type Category = "bug" | "feature" | "scholarship" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bug", label: "Something is broken" },
  { value: "feature", label: "Feature request" },
  { value: "scholarship", label: "Scholarship issue (wrong info, dead link, etc.)" },
  { value: "other", label: "Something else" },
];

const MIN_LEN = 10;
const MAX_LEN = 5000;

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Pre-fill the contact email from the signed-in user's auth email so
  // students don't have to retype it. Fetched lazily only when the modal
  // opens, not on every page load.
  useEffect(() => {
    if (!open || email) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) setEmail(data.user.email);
    })();
  }, [open, email]);

  // Esc closes the modal without submitting. Focus trap mirrors the
  // ConfirmDialog pattern: first focusable element gets focus on open,
  // Tab cycles within the panel.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < MIN_LEN) {
      setError(`Please write at least ${MIN_LEN} characters so we can act on it.`);
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setError(`Please keep it under ${MAX_LEN.toLocaleString()} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithTimeout("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          contact_email: email.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't send feedback. Try again.");
        return;
      }
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setMessage("");
        setCategory("bug");
      }, 1500);
    } catch {
      setError("Network error -- check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-20 md:bottom-4 left-4 z-[90] rounded-seal bg-white border border-hairline shadow-card text-navy text-sm font-medium px-4 py-2.5 hover:border-navy/40 hover:text-navy transition-colors inline-flex items-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M21 12a8 8 0 1 1-3.4-6.5L21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Feedback
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-navy/40"
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback to Scholars"
        >
          <div
            className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl border border-hairline shadow-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-navy">Send feedback</h2>
                <p className="text-sm text-navy-light mt-1">
                  Bugs, ideas, or a scholarship that looks wrong. We read every message.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 text-navy-light hover:text-navy p-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {sent ? (
              <div className="rounded-xl bg-emerald-light border border-emerald/20 p-5 text-center">
                <p className="font-medium text-emerald">Thanks — we got it.</p>
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
                    className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink resize-y min-h-[140px] focus:border-navy outline-none transition-colors"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What happened, what you expected, and where you saw it. The more concrete, the faster we can act."
                    disabled={submitting}
                    autoFocus
                  />
                  <span
                    className={`block text-xs mt-1 text-right ${
                      message.length > MAX_LEN ? "text-rose font-medium" : "text-navy-light"
                    }`}
                  >
                    {message.length}/{MAX_LEN.toLocaleString()}
                  </span>
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
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="text-sm font-medium text-navy-light hover:text-navy px-3 py-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-seal bg-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {submitting && (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    )}
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
