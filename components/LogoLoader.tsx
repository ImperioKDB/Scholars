import { LogoMark } from "@/components/Logo";

type LogoLoaderVariant = "page" | "section";

export function LogoLoader({
  variant = "section",
  label = "Loading…",
}: {
  variant?: LogoLoaderVariant;
  label?: string;
}) {
  return (
    <div
      className={`logo-loader logo-loader--${variant}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">Loading</span>
      <div className="logo-loader__content">
        <div className="logo-loader__ring" aria-hidden="true">
          <svg className="logo-loader__svg" viewBox="0 0 100 100" focusable="false">
            <circle className="logo-loader__track" cx="50" cy="50" r="46" />
            <circle
              className="logo-loader__arc"
              cx="50"
              cy="50"
              r="46"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <LogoMark className="logo-loader__mark" />
        </div>
        <p className="logo-loader__text">{label}</p>
      </div>
    </div>
  );
}
