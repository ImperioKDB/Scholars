"use client";

type TourProgressProps = {
  steps: readonly string[];
  currentStep: number;
};

export function TourProgress({ steps, currentStep }: TourProgressProps) {
  const safeStep = Math.min(Math.max(currentStep, 0), Math.max(steps.length - 1, 0));
  const progress = steps.length > 1 ? (safeStep / (steps.length - 1)) * 100 : 100;

  return (
    <div className="mb-5" aria-label={`Tour progress: step ${safeStep + 1} of ${steps.length}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-light">Tour progress</p>
        <p className="text-xs font-medium text-emerald" aria-hidden="true">{safeStep + 1} of {steps.length}</p>
      </div>
      <div
        className="relative"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={safeStep + 1}
        aria-valuetext={`${steps[safeStep] ?? "Current step"}, step ${safeStep + 1} of ${steps.length}`}
      >
        <div className="tour-progress-track" aria-hidden="true">
          <span className="tour-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <ol className="relative flex items-start justify-between">
          {steps.map((label, index) => {
            const isComplete = index < safeStep;
            const isCurrent = index === safeStep;
            return (
              <li key={label} className="flex min-w-0 flex-col items-center">
                <span
                  className={`tour-progress-node ${isComplete ? "tour-progress-node-complete" : ""} ${isCurrent ? "tour-progress-node-current" : ""}`}
                  aria-hidden="true"
                >
                  {isComplete ? "✓" : index + 1}
                </span>
                <span className={`mt-1.5 max-w-[4.5rem] truncate text-center text-[10px] leading-tight ${isCurrent ? "font-semibold text-navy" : "text-navy-light"}`}>
                  <span className="sr-only">{isComplete ? "Completed: " : isCurrent ? "Current: " : "Upcoming: "}</span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
