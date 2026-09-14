import { notFound, permanentRedirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

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
    .select("slug")
    .eq("id", id)
    .eq("verified", true)
    .maybeSingle();
  if (!data?.slug) notFound();
  permanentRedirect(`/scholarship/${data.slug}`);
}
