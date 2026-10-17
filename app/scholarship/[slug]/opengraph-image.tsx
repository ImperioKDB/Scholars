import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import { ShareCard } from "@/lib/og/ShareCard";

export const revalidate = 3600;
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_COLUMNS = "title, provider_name, amount, deadline";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const isLegacyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const query = supabase.from("scholarships").select(OG_COLUMNS).eq("verified", true);
  const { data: scholarship } = await (isLegacyId ? query.eq("id", slug) : query.eq("slug", slug)).maybeSingle();

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
