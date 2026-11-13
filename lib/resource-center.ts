import { createClient } from "./supabase/server";
import {
  getLocalResourceArticle,
  getLocalResourceArticlesForCategory,
  getLocalResourceCategoriesForArticle,
  getLocalResourceCategory,
  LOCAL_RESOURCE_ARTICLE_CARDS,
  LOCAL_RESOURCE_CATEGORIES,
} from "./resource-content";

export const RESOURCE_IMAGE_PREFIX = "resource-center/featured/";
export const RESOURCE_PAGE_SIZE = 100;
const APPROVED_CANONICAL_HOST = "www.scholars.com.ng";

export type ResourceArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_markdown: string;
  article_type: string;
  canonical_url: string | null;
  featured_image_path: string | null;
  reading_time_minutes: number | null;
  published_at: string;
  last_reviewed_at: string | null;
  author_name: string;
  author_bio: string | null;
  author_avatar_path: string | null;
};

export type ResourceArticleCard = Pick<ResourceArticle, "id" | "slug" | "title" | "excerpt" | "article_type" | "published_at" | "reading_time_minutes" | "author_name" | "featured_image_path">;

export type ResourceCategory = { id: string; slug: string; name: string; description: string | null; display_order: number };
export type ResourceCategoryLink = { article_id: string; category_id: string; slug: string; name: string; description: string | null; display_order: number };

export class ResourceDataError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ResourceDataError";
    if (cause) this.cause = cause;
  }
}

const CARD_SELECT = "id,slug,title,excerpt,article_type,published_at,reading_time_minutes,author_name,featured_image_path";
const ARTICLE_SELECT = "id,slug,title,excerpt,content_markdown,article_type,canonical_url,featured_image_path,reading_time_minutes,published_at,last_reviewed_at,author_name,author_bio,author_avatar_path";

function assertNoError<T>(data: T | null, error: unknown, message: string): T {
  if (error) {
    console.error(`[resources] ${message}`, error);
    throw new ResourceDataError(message, error);
  }
  return data as T;
}

export async function getResourceHome() {
  const supabase = createClient();
  const [{ data: articles, error: articlesError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase.from("resource_public_articles").select(CARD_SELECT).order("published_at", { ascending: false }).order("id", { ascending: true }).limit(50),
    supabase.from("resource_public_categories").select("id,slug,name,description,display_order").order("display_order", { ascending: true }).order("slug", { ascending: true }).limit(30),
  ]);
  return {
    articles: assertNoError((articles ?? []) as ResourceArticleCard[], articlesError, "Unable to load public resources"),
    categories: assertNoError((categories ?? []) as ResourceCategory[], categoriesError, "Unable to load resource categories"),
  };
}

export async function getResourceCategory(slug: string) {
  const supabase = createClient();
  const { data: category, error: categoryError } = await supabase.from("resource_public_categories").select("id,slug,name,description,display_order").eq("slug", slug).maybeSingle();
  if (categoryError) throw new ResourceDataError("Unable to load this resource category", categoryError);
  if (!category) return null;

  const { count, error: countError } = await supabase.from("resource_public_article_categories").select("article_id", { count: "exact", head: true }).eq("slug", slug);
  if (countError) throw new ResourceDataError("Unable to count category articles", countError);
  const articleIds = await readAllCategoryArticleIds(supabase, slug);
  const articles = await readArticlesByIds(supabase, articleIds);
  return {
    category: category as ResourceCategory,
    articles,
    totalCount: count ?? articleIds.length,
  };
}

async function readAllCategoryArticleIds(supabase: ReturnType<typeof createClient>, slug: string): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += RESOURCE_PAGE_SIZE) {
    const { data, error } = await supabase.from("resource_public_article_categories").select("article_id").eq("slug", slug).order("article_id", { ascending: true }).range(from, from + RESOURCE_PAGE_SIZE - 1);
    const batch = assertNoError(data ?? [], error, "Unable to load category articles") as Array<{ article_id: string }>;
    ids.push(...batch.map((row) => row.article_id));
    if (batch.length < RESOURCE_PAGE_SIZE) return [...new Set(ids)];
  }
}

async function readArticlesByIds(supabase: ReturnType<typeof createClient>, ids: string[]): Promise<ResourceArticleCard[]> {
  const articles: ResourceArticleCard[] = [];
  for (let from = 0; from < ids.length; from += RESOURCE_PAGE_SIZE) {
    const chunk = ids.slice(from, from + RESOURCE_PAGE_SIZE);
    const { data, error } = await supabase.from("resource_public_articles").select(CARD_SELECT).in("id", chunk).limit(RESOURCE_PAGE_SIZE);
    articles.push(...(assertNoError((data ?? []) as ResourceArticleCard[], error, "Unable to load category articles")));
  }
  return articles.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || a.id.localeCompare(b.id));
}

export async function getResourceArticle(slug: string) {
  const supabase = createClient();
  const { data: article, error: articleError } = await supabase.from("resource_public_articles").select(ARTICLE_SELECT).eq("slug", slug).maybeSingle();
  if (articleError) throw new ResourceDataError("Unable to load this resource", articleError);
  if (!article) return null;

  const { data: categories, error: categoriesError } = await supabase.from("resource_public_article_categories").select("article_id,category_id,slug,name,description,display_order").eq("article_id", article.id).order("display_order", { ascending: true }).order("slug", { ascending: true }).limit(20);
  const categoryLinks = assertNoError((categories ?? []) as ResourceCategoryLink[], categoriesError, "Unable to load article categories");
  const categorySlugs = [...new Set(categoryLinks.map((category) => category.slug))];
  const related = categorySlugs.length > 0 ? await getRelatedArticles(supabase, categorySlugs, article.id) : [];
  return { article: article as ResourceArticle, categories: categoryLinks, related };
}

async function getRelatedArticles(supabase: ReturnType<typeof createClient>, categorySlugs: string[], currentArticleId: string) {
  const relatedCounts = new Map<string, number>();
  for (let from = 0; ; from += RESOURCE_PAGE_SIZE) {
    const { data, error } = await supabase.from("resource_public_article_categories").select("article_id").in("slug", categorySlugs).neq("article_id", currentArticleId).order("article_id", { ascending: true }).range(from, from + RESOURCE_PAGE_SIZE - 1);
    const batch = assertNoError(data ?? [], error, "Unable to load related resources") as Array<{ article_id: string }>;
    batch.forEach((row) => relatedCounts.set(row.article_id, (relatedCounts.get(row.article_id) ?? 0) + 1));
    if (batch.length < RESOURCE_PAGE_SIZE) break;
  }
  const candidates = await readArticlesByIds(supabase, [...relatedCounts.keys()]);
  return candidates.sort((a, b) => (relatedCounts.get(b.id) ?? 0) - (relatedCounts.get(a.id) ?? 0) || Date.parse(b.published_at) - Date.parse(a.published_at) || a.id.localeCompare(b.id)).slice(0, 3);
}

export function getResourceImageUrl(path: string | null | undefined): string | null {
  if (!isApprovedResourceImagePath(path)) return null;
  if (!hasPublicSupabaseConfig()) return null;
  const supabase = createClient();
  return supabase.storage.from("site").getPublicUrl(path).data.publicUrl || null;
}

export function isApprovedResourceImagePath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith(RESOURCE_IMAGE_PREFIX) && !path.includes("..") && !path.includes("\\") && !path.includes("//"));
}

export function getResourceCanonicalUrl(slug: string, storedCanonical: string | null): string {
  const expectedPath = `/resources/${slug}`;
  const fallback = `https://${APPROVED_CANONICAL_HOST}${expectedPath}`;
  if (!storedCanonical) return fallback;
  try {
    const candidate = new URL(storedCanonical);
    const normalizedPath = candidate.pathname.replace(/\/+$/, "") || "/";
    if (candidate.protocol === "https:" && candidate.hostname === APPROVED_CANONICAL_HOST && !candidate.port && !candidate.username && !candidate.password && !candidate.search && !candidate.hash && normalizedPath === expectedPath) {
      return fallback;
    }
  } catch {
    // Use the exact route fallback below.
  }
  return fallback;
}

/**
 * Repository content is the launch source of truth. The public projection is
 * still read when available so reviewed database-backed articles can be added
 * later without changing the public route contract. No private/base table is
 * queried here and no editorial write path is introduced.
 */
export async function getResourceHomeWithRepositoryContent() {
  let published: Awaited<ReturnType<typeof getResourceHome>> = { articles: [], categories: [] };
  if (hasPublicSupabaseConfig()) {
    try {
      published = await getResourceHome();
    } catch {
      // The repository-backed launch experience remains available when the
      // optional public projection is unavailable during build or preview.
    }
  }
  return {
    articles: mergeBySlug(LOCAL_RESOURCE_ARTICLE_CARDS, published.articles),
    categories: mergeBySlug(LOCAL_RESOURCE_CATEGORIES, published.categories),
  };
}

export async function getResourceArticleWithRepositoryContent(slug: string) {
  const localArticle = getLocalResourceArticle(slug);
  if (localArticle) {
    const localCategories = getLocalResourceCategoriesForArticle(localArticle.id);
    const related = LOCAL_RESOURCE_ARTICLE_CARDS
      .filter((article) => article.id !== localArticle.id && localCategories.some((category) => getLocalResourceCategoriesForArticle(article.id).some((candidate) => candidate.slug === category.slug)))
      .slice(0, 3);
    return { article: localArticle, categories: localCategories, related };
  }
  return hasPublicSupabaseConfig() ? getResourceArticle(slug) : null;
}

export async function getResourceCategoryWithRepositoryContent(slug: string) {
  const localCategory = getLocalResourceCategory(slug);
  let published: Awaited<ReturnType<typeof getResourceCategory>> = null;
  if (hasPublicSupabaseConfig()) {
    try {
      published = await getResourceCategory(slug);
    } catch {
      // Local content is intentionally sufficient for the public MVP.
    }
  }
  if (!localCategory) return published;
  const localArticles = getLocalResourceArticlesForCategory(slug);
  const publishedArticles = published?.articles ?? [];
  return {
    category: localCategory,
    articles: mergeBySlug(localArticles, publishedArticles),
    totalCount: localArticles.length + publishedArticles.filter((article) => !localArticles.some((local) => local.slug === article.slug)).length,
  };
}

function mergeBySlug<T extends { slug: string }>(primary: T[], secondary: T[]): T[] {
  const merged = new Map<string, T>();
  [...primary, ...secondary].forEach((item) => merged.set(item.slug, item));
  return [...merged.values()];
}

function hasPublicSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
