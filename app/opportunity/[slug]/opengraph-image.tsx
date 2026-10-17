import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import { ShareCard } from "@/lib/og/ShareCard";

export const revalidate = 3600;
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_COLUMNS = "title, provider_name, compensation, deadline";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select(OG_COLUMNS)
    .eq("slug", slug)
    .eq("verified", true)
    .maybeSingle();

  return new ImageResponse(
    <ShareCard
      kind="opportunity"
      title={opportunity?.title ?? "Find opportunities on Scholars"}
      provider={opportunity?.provider_name ?? "Opportunity"}
      primaryLabel="Support"
      primaryValue={opportunity?.compensation}
      deadline={opportunity?.deadline}
    />,
    { ...size },
  );
}
