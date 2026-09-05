"use client";

// app/global-error.tsx
// Root-level error boundary. Renders only when the root layout itself
// throws, so it must provide its own <html> and <body>. Tailwind and
// globals.css may not be loaded at this point, hence inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F5EF",
          color: "#10151F",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E4E1D8",
            borderRadius: "16px",
            boxShadow: "0 1px 2px rgba(11,30,61,0.06), 0 1px 12px rgba(11,30,61,0.05)",
            padding: "32px",
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#A63A35",
              margin: "0 0 16px",
              fontWeight: 600,
            }}
          >
            Something broke
          </p>
          <h1 style={{ fontSize: "24px", color: "#0B1E3D", margin: "0 0 8px" }}>
            Scholars hit an unexpected error
          </h1>
          <p style={{ fontSize: "14px", color: "#14315C", lineHeight: 1.6, margin: "0 0 24px" }}>
            Trying again usually fixes it. Your data is safe on the server either way.
          </p>
          {error.digest && (
            <p style={{ fontSize: "12px", color: "#14315C", margin: "0 0 24px" }}>
              Error reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#0B1E3D",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 500,
              padding: "10px 24px",
              borderRadius: "9999px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
