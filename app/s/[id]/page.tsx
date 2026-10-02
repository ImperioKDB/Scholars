import { notFound, permanentRedirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { todayUtcIso } from "@/lib/dates";

export const revalidate = 300;

export default async function LegacyScholarshipSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("scholarships")
    .select("slug, deadline, last_cycle_closed_at")
    .eq("id", id)
    .eq("verified", true)
    .or(`deadline.is.null,deadline.gte.${todayUtcIso()}`)
    .or(`last_cycle_closed_at.is.null,last_cycle_closed_at.gt.${todayUtcIso()}`)
    .maybeSingle();
  if (!data?.slug) notFound();
  permanentRedirect(`/scholarship/${data.slug}`);
}
