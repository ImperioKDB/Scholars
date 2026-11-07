import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";

type Article = { id: string; title: string; slug: string; status: string; article_type: string; updated_at: string; author_identity_id: string; reviewer_identity_id: string | null };
export default async function AdminResourcesPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data: articles, error } = await supabase.from("resource_articles").select("id,title,slug,status,article_type,updated_at,author_identity_id,reviewer_identity_id").order("updated_at", { ascending: false }).limit(100);
  const rows = (articles ?? []) as Article[];
  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald">Editorial workspace</p><h1 className="mt-2 font-display text-3xl font-semibold text-navy">Resource Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-navy-light">Review article state and prepare the next approved guide. Public visitors can only see published rows through the public projection views.</p></div>
        <span className="rounded-seal bg-amber-light px-3 py-2 text-xs font-semibold text-amber">Publishing workflow next</span>
      </div>
      {error ? <div className="rounded-xl border border-rose/20 bg-rose-light p-4 text-sm text-rose">The Resource Center schema is unavailable. Apply the approved migration before using this workspace.</div> : rows.length === 0 ? <div className="rounded-2xl border border-hairline bg-white p-8"><h2 className="font-display text-2xl font-semibold text-navy">No articles yet</h2><p className="mt-2 text-sm leading-6 text-navy-light">The schema is ready. The first article will appear here after the editorial workflow is connected.</p><Link href="/resources" className="mt-5 inline-flex rounded-seal bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-light">View public Resource Center</Link></div> : <div className="overflow-hidden rounded-2xl border border-hairline bg-white"><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead className="border-b border-hairline bg-parchment text-xs uppercase tracking-[0.12em] text-navy-light"><tr><th className="px-5 py-4 font-semibold">Article</th><th className="px-5 py-4 font-semibold">Status</th><th className="px-5 py-4 font-semibold">Type</th><th className="px-5 py-4 font-semibold">Updated</th></tr></thead><tbody className="divide-y divide-hairline">{rows.map((article) => <tr key={article.id}><td className="px-5 py-4"><p className="font-semibold text-navy">{article.title}</p><p className="mt-1 font-mono text-xs text-navy-light">/resources/{article.slug}</p></td><td className="px-5 py-4"><span className="rounded-seal bg-navy-50 px-3 py-1.5 text-xs font-semibold capitalize text-navy">{article.status.replace("_", " ")}</span></td><td className="px-5 py-4 text-navy-light">{article.article_type}</td><td className="px-5 py-4 text-navy-light">{new Date(article.updated_at).toLocaleDateString("en-NG")}</td></tr>)}</tbody></table></div></div>}
    </div>
  );
}
