"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResourceArticleCard } from "@/lib/resource-center";

export type SearchableArticle = ResourceArticleCard & {
  content_markdown?: string;
  categoryNames?: string[];
};

export function ResourceSearch({ articles }: { articles: SearchableArticle[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!normalized) return [];
    return articles
      .filter((article) => {
        const haystack = [
          article.title,
          article.excerpt ?? "",
          article.article_type,
          article.content_markdown ?? "",
          article.categoryNames?.join(" ") ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 6);
  }, [articles, normalized]);

  return (
    <div className="relative w-full max-w-md">
      <label htmlFor="resource-search" className="sr-only">Search Resource Center</label>
      <input
        id="resource-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search guides"
        className="w-full rounded-seal border border-hairline bg-white px-4 py-3 pr-10 text-sm text-navy placeholder:text-navy-light/70"
      />
      {normalized && (
        <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-hairline bg-white p-2 shadow-card" role="status" aria-live="polite">
          {matches.length > 0 ? matches.map((article) => (
            <Link key={article.id} href={`/resources/${article.slug}`} onClick={() => setQuery("")} className="block rounded-xl px-3 py-3 hover:bg-navy-50">
              <span className="block text-sm font-semibold text-navy">{article.title}</span>
              <span className="mt-1 block text-xs text-navy-light">{article.article_type}{article.reading_time_minutes ? ` · ${article.reading_time_minutes} min read` : ""}</span>
            </Link>
          )) : <p className="px-3 py-3 text-sm text-navy-light">No guide matches that search yet.</p>}
        </div>
      )}
    </div>
  );
}
