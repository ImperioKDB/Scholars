"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// components/DeleteAccountButton.tsx
//
// Self-serve account deletion (privacy transparency batch). Deletes the
// student's own profiles row via DELETE /api/profile; FK ON DELETE CASCADE
// removes saved scholarships, applications, WAEC results, notifications,
// achievements, and XP in one statement (see migration
// 0014_add_feedback_table.sql for the profiles_delete_own policy).
//
// Honest scope, stated in the confirm copy: the Supabase Auth user row
// (just the email) is owned by Supabase Auth and stays until the student
// emails support for full erasure. We sign out and bounce to the landing
// page on success.
export function DeleteAccountButton() {
  const supabase = createClient();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't delete your account. Try again.");
        setDeleting(false);
        setConfirmOpen(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-hairline">
      {error && (
        <p role="alert" className="text-sm text-rose mb-3">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        className="rounded-seal border border-rose/40 text-rose text-sm font-medium px-5 py-2.5 hover:bg-rose-light transition-colors disabled:opacity-60"
      >
        {deleting ? "Deleting\u2026" : "Delete my account"}
      </button>
      {confirmOpen && (
        <ConfirmDialog
          message="Delete your account? This removes your profile, saved scholarships, tracked applications, WAEC results, achievements, and XP from Scholars. This cannot be undone. Your sign-in email stays in our auth system until you email support.scholarsteam@gmail.com asking for full removal."
          onConfirm={handleDelete}
          onClose={() => !deleting && setConfirmOpen(false)}
          confirmLabel="Delete my account"
          cancelLabel="Keep my account"
          tone="rose"
        />
      )}
    </div>
  );
}
