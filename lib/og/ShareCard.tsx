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

function formatShareValue(value?: string | null, kind: ShareCardKind = "scholarship") {
  const fallback = kind === "scholarship" ? "See listing" : "Details in listing";
  // Satori's default font does not consistently include the Naira glyph.
  // Spell it out so the award remains readable in every social preview.
  return (value || fallback).replace(/₦\s*/g, "NGN ");
}

function titleFontSize(title: string) {
  if (title.length <= 42) return 52;
  if (title.length <= 72) return 46;
  if (title.length <= 105) return 40;
  return 34;
}

function BrandMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r="35" fill="none" stroke="#35B8B0" strokeWidth="2" />
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

function DetailBox({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 8,
        minWidth: 0,
        flex: 1,
        padding: "15px 17px",
        borderRadius: 16,
        background: prominent ? "#172342" : "#E9EEE9",
      }}
    >
      <div
        style={{
          display: "flex",
          color: prominent ? "#92D8D0" : "#536276",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: 1.5,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          color: prominent ? "#FFFFFF" : "#172342",
          fontSize: 23,
          fontWeight: 800,
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ShareCard({ kind, title, provider, primaryLabel, primaryValue, deadline }: ShareCardProps): ReactNode {
  const kindLabel = kind === "scholarship" ? "SCHOLARSHIP" : "OPPORTUNITY";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "#172342",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          border: "2px solid rgba(53,184,176,0.18)",
          borderRadius: 999,
          left: -390,
          top: -390,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          border: "2px solid rgba(247,245,239,0.08)",
          borderRadius: 999,
          right: -300,
          bottom: -370,
        }}
      />

      {/* The centered 630px square is the safe area used by social clients
          that crop landscape Open Graph images to a near-square thumbnail. */}
      <div
        style={{
          width: 760,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          padding: "42px 68px 38px",
          background: "#F7F5EF",
          borderLeft: "1px solid #DFE4DE",
          borderRight: "1px solid #DFE4DE",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 27 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandMark />
              <div style={{ display: "flex", color: "#172342", fontSize: 25, fontWeight: 800, letterSpacing: -0.5 }}>
                Scholars
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "9px 13px",
                borderRadius: 999,
                background: "#DDF1EC",
                color: "#146C6D",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 1.1,
              }}
            >
              {kindLabel}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", color: "#536276", fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
              {provider}
            </div>
            <div
              style={{
                display: "flex",
                color: "#172342",
                fontSize: titleFontSize(title),
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: -1.1,
              }}
            >
              {title}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, width: "100%" }}>
            <DetailBox label={primaryLabel} value={formatShareValue(primaryValue, kind)} prominent />
            <DetailBox label="Deadline" value={formatDeadline(deadline)} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", color: "#536276", fontSize: 15, fontWeight: 700 }}>
            Shared from scholars.com.ng
          </div>
        </div>
      </div>
    </div>
  );
}
