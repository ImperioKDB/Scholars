export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex items-center w-full mb-10">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={[
                  "flex items-center justify-center w-8 h-8 rounded-seal border font-mono text-xs transition-colors",
                  done
                    ? "bg-navy border-navy text-white"
                    : active
                    ? "border-navy text-navy"
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
                className={[
                  "h-px flex-1 mx-3 mb-6 sm:mb-6",
                  done ? "bg-navy" : "bg-hairline",
                ].join(" ")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
