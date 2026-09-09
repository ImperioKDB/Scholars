import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";

// app/o/[id]/opengraph-image.tsx
// Auto-wired by Next.js to the og:image / twitter:image meta tags for the
// sibling app/o/[id]/page.tsx -- no manual <meta> tag needed. Same job as
// the scholarship OG image (app/s/[id]/opengraph-image.tsx): the card has
// to be recognizable as Scholars, and legible, inside a WhatsApp/iMessage
// link preview before anyone taps it. The pill reads "Opportunity" for all
// four kinds (fellowship/internship/competition/mentorship) -- the detail
// page carries the specific type badge.
//
// PERF (batch 1 pattern): chat clients re-fetch previews aggressively.
// Revalidate caps OG re-render cost at once per hour.
//
// COLOR CONSISTENCY: the accent uses the darkened emerald token (#15705A)
// instead of the old pre-audit #1B8A6B, matching the rest of the app.
export const revalidate = 3600;
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_COLUMNS = "title, provider_name, compensation, deadline, type";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createPublicClient();
  const { data: opportunity } = await supabase
    .from("opportunities")
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
        <div style={{ display: "flex", fontSize: 30, color: "#15705A", fontWeight: 700 }}>
          Scholars
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 24, color: "#8B93A3", marginBottom: 14 }}>
            {opportunity?.provider_name ?? "Opportunity"}
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
            {opportunity?.title ?? "Find opportunities on Scholars"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 26, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              background: "#15705A",
              color: "#0B1E3D",
              padding: "10px 24px",
              borderRadius: 999,
              fontWeight: 700,
            }}
          >
            Opportunity
          </div>
          {opportunity?.compensation && (
            <div style={{ display: "flex", color: "#C9CDD6" }}>{opportunity.compensation}</div>
          )}
          {opportunity?.deadline ? (
            <div style={{ display: "flex", color: "#C9CDD6" }}>Deadline {opportunity.deadline}</div>
          ) : (
            <div style={{ display: "flex", color: "#C9CDD6" }}>Rolling</div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
