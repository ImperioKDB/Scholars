import type { CSSProperties } from "react";

export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <nav aria-label="Onboarding progress">
      <p className="sr-only" aria-live="polite">Step {current + 1} of {steps.length}: {steps[current]}</p>
      <ol className="flex items-center w-full mb-10" style={{ "--step-progress": `${steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100}%` } as CSSProperties}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                aria-current={active ? "step" : undefined}
                aria-label={`${done ? "Completed" : active ? "Current" : "Upcoming"}: ${label}`}
                className={[
                  "flex items-center justify-center w-8 h-8 rounded-seal border font-mono text-xs transition-[background-color,border-color,color,transform] duration-300",
                  done
                    ? "bg-navy border-navy text-white"
                    : active
                    ? "border-navy text-navy scale-105"
                    : "border-hairline text-navy-light",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={[
                  "text-xs font-medium hidden sm:block",
                  active || done ? "text-navy" : "text-navy-light",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="relative h-px flex-1 mx-3 mb-6 sm:mb-6 overflow-hidden bg-hairline"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-navy origin-left transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{ transform: `scaleX(${i < current ? 1 : i === current ? "var(--step-progress)" : 0})`, width: "100%" }}
                />
              </div>
            )}
          </li>
        );
      })}
      </ol>
    </nav>
  );
}
