"use client";
import { useOverlayAccessibility } from "@/lib/useOverlayAccessibility";

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
  const panelRef = useOverlayAccessibility(true, onClose);

  const confirmToneClass = tone === "rose" ? "bg-rose hover:bg-rose/90" : "bg-navy hover:bg-navy-light";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/40" role="dialog" aria-modal="true" aria-labelledby="confirm-message">
      <div
        ref={panelRef}
        className="bg-white rounded-2xl border border-hairline shadow-card p-6 max-w-sm w-full"
      >
        <p id="confirm-message" className="text-sm text-ink leading-relaxed mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button
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
