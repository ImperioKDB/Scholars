import type { ReactNode } from "react";

export type ShareCardKind = "scholarship" | "opportunity";

type ShareCardProps = {
  kind: ShareCardKind;
  title: string;
  provider: string;
  primaryLabel: string;
  primaryValue?: string | null;
  deadline?: string | null;
};

function formatDeadline(value?: string | null) {
  if (!value) return "Rolling";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function BrandMark() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r="35" fill="none" stroke="#35B8B0" strokeWidth="2" opacity="0.9" />
      <path
        d="M53 19C43 13 31 13 22 18C13 23 10 32 12 40C14 49 21 54 31 57L37 49C31 47 26 44 25 39C23 33 26 28 32 25C38 22 45 23 51 26L53 19Z"
        fill="#F7F5EF"
      />
      <path
        d="M23 57C33 63 45 63 54 58C63 53 66 44 64 36C62 29 56 24 47 22L41 30C47 32 51 35 52 40C53 45 49 50 43 51C37 53 31 50 26 47L23 57Z"
        fill="#F7F5EF"
      />
      <path d="M17 57C32 53 47 42 58 18" fill="none" stroke="#2CAAAE" strokeWidth="7" />
      <path d="M58 12L65 29L58 27L54 36L49 31L53 22L48 21L58 12Z" fill="#35C0B6" />
    </svg>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", fontSize: 15, fontWeight: 700, letterSpacing: 1.4, color: "#718096" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#172342", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

export function ShareCard({ kind, title, provider, primaryLabel, primaryValue, deadline }: ShareCardProps): ReactNode {
  const kindLabel = kind === "scholarship" ? "SCHOLARSHIP" : "OPPORTUNITY";
  const value = primaryValue || (kind === "scholarship" ? "See listing" : "Details in listing");

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#F7F5EF",
        color: "#172342",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ width: 390, height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#172342", padding: "58px 54px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <BrandMark />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", color: "#F7F5EF", fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>Scholars</div>
              <div style={{ display: "flex", color: "#92D8D0", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>FIND YOUR NEXT STEP</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", width: 48, height: 5, background: "#35B8B0" }} />
            <div style={{ display: "flex", color: "#D6E8E3", fontSize: 22, lineHeight: 1.25, maxWidth: 230 }}>Opportunities worth sharing.</div>
          </div>
        </div>
        <div style={{ position: "absolute", width: 440, height: 440, border: "2px solid rgba(53,184,176,0.26)", borderRadius: 999, top: 255, left: -210 }} />
        <div style={{ position: "absolute", width: 320, height: 320, border: "2px solid rgba(247,245,239,0.13)", borderRadius: 999, top: 320, left: -145 }} />
        <div style={{ position: "absolute", width: 520, height: 52, background: "#248A9A", transform: "rotate(-34deg)", bottom: 74, left: -100, opacity: 0.9 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "66px 72px 58px 66px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: "#2CAAAE" }} />
            <div style={{ display: "flex", color: "#167276", fontSize: 18, fontWeight: 800, letterSpacing: 2.5 }}>{kindLabel}</div>
          </div>
          <div style={{ display: "flex", color: "#64748B", fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>{provider}</div>
          <div style={{ display: "flex", color: "#172342", fontSize: 54, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.4, maxWidth: 650 }}>{title}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", height: 1, width: "100%", background: "#D7DDD8" }} />
          <div style={{ display: "flex", gap: 42 }}>
            <MetaItem label={primaryLabel.toUpperCase()} value={value} />
            <MetaItem label="DEADLINE" value={formatDeadline(deadline)} />
          </div>
          <div style={{ display: "flex", color: "#64748B", fontSize: 18, fontWeight: 600 }}>Shared from scholars.com.ng</div>
        </div>
      </div>
    </div>
  );
}
