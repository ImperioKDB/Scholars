"use client";
import { useEffect, useRef } from "react";

// components/ConfirmDialog.tsx
//
// Modal replacement for window.confirm() (audit P6 - quick win).
// Browser-native confirm is ugly on mobile, blocks the thread, can't be
// styled or translated, and has small touch targets causing accidental
// deletions. This modal is keyboard-accessible, focus-trapped, and
// styled to match the app.
//
// USAGE:
//   const [confirmState, setConfirmState] = useState<{message, onConfirm} | null>(null);
//   // instead of if (confirm("Delete?")) doAction()
//   setConfirmState({ message: "Delete this?", onConfirm: doAction });
//   // render: {confirmState && <ConfirmDialog ... onClose={() => setConfirmState(null)} />}
export function ConfirmDialog({
  message,
  onConfirm,
  onClose,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "rose",
}: {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "rose" | "navy";
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      // Focus trap
      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const confirmToneClass = tone === "rose" ? "bg-rose hover:bg-rose/90" : "bg-navy hover:bg-navy-light";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/40" role="dialog" aria-modal="true">
      <div
        ref={panelRef}
        className="bg-white rounded-2xl border border-hairline shadow-card p-6 max-w-sm w-full"
      >
        <p className="text-sm text-ink leading-relaxed mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-navy-light hover:text-navy px-4 py-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`text-sm font-medium text-white rounded-seal px-5 py-2 transition-colors ${confirmToneClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
