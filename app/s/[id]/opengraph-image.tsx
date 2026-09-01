import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";

// app/s/[id]/opengraph-image.tsx
// Auto-wired by Next.js to the og:image / twitter:image meta tags for the
// sibling app/s/[id]/page.tsx -- no manual <meta> tag needed. This is what
// actually renders inline inside a WhatsApp/iMessage/Slack link preview,
// which is the entire point of the share feature: the card has to be
// recognizable as Scholars, and legible, before anyone taps it.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_COLUMNS = "title, provider_name, amount, deadline";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createPublicClient();
  const { data: scholarship } = await supabase
    .from("scholarships")
    .select(OG_COLUMNS)
    .eq("id", id)
    .eq("verified", true)
    .maybeSingle();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B1E3D",
          color: "#F7F5EF",
          padding: "64px 68px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#1B8A6B", fontWeight: 700 }}>
          Scholars
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 24, color: "#8B93A3", marginBottom: 14 }}>
            {scholarship?.provider_name ?? "Scholarship opportunity"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: 1000,
            }}
          >
            {scholarship?.title ?? "Find scholarships you're eligible for"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, fontSize: 26 }}>
          {scholarship?.amount && (
            <div
              style={{
                display: "flex",
                background: "#1B8A6B",
                color: "#0B1E3D",
                padding: "10px 24px",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {scholarship.amount}
            </div>
          )}
          {scholarship?.deadline && (
            <div style={{ display: "flex", color: "#C9CDD6", alignItems: "center" }}>
              Deadline {scholarship.deadline}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
