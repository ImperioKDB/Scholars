"use client";

import type { EmailBatch } from "@/lib/email/batches";

export function EmailBatchButtons({
  onSelect,
  disabled = false,
  selected,
  sentBatches,
  tone = "navy",
}: {
  onSelect: (batch: EmailBatch) => void;
  disabled?: boolean;
  selected?: EmailBatch | null;
  sentBatches?: Partial<Record<EmailBatch, boolean>>;
  tone?: "navy" | "emerald" | "rose";
}) {
  const styles = {
    navy: "bg-navy text-white hover:bg-navy-light",
    emerald: "bg-emerald text-white hover:bg-emerald/90",
    rose: "border border-rose/40 text-rose hover:bg-rose-light",
  }[tone];

  return (
    <div className="flex flex-wrap gap-2" aria-label="Email student batch">
      {(["A", "B", "C"] as EmailBatch[]).map((batch) => {
        const sent = sentBatches?.[batch] === true;
        return (
          <button
            key={batch}
            type="button"
            onClick={() => onSelect(batch)}
            disabled={disabled || sent}
            className={`rounded-seal text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-60 ${styles} ${selected === batch ? "ring-2 ring-amber ring-offset-2" : ""}`}
          >
            {sent ? `Batch ${batch} sent` : `Batch ${batch}`}
          </button>
        );
      })}
    </div>
  );
}
