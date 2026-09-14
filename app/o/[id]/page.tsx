import { notFound, permanentRedirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 300;

export default async function LegacyOpportunitySharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("opportunities")
    .select("slug")
    .eq("id", id)
    .eq("verified", true)
    .maybeSingle();
  if (!data?.slug) notFound();
  permanentRedirect(`/opportunity/${data.slug}`);
}
