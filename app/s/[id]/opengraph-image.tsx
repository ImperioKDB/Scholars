import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import { ShareCard } from "@/lib/og/ShareCard";

export const revalidate = 3600;
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
    <ShareCard
      kind="scholarship"
      title={scholarship?.title ?? "Find scholarships you're eligible for"}
      provider={scholarship?.provider_name ?? "Scholarship opportunity"}
      primaryLabel="Award"
      primaryValue={scholarship?.amount}
      deadline={scholarship?.deadline}
    />,
    { ...size },
  );
}
