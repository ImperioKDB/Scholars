import { createClient } from "./supabase/server";

export const RESOURCE_IMAGE_PREFIX = "resource-center/featured/";
export const RESOURCE_PAGE_SIZE = 12;

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

export type ResourceArticleCard = Pick<
  ResourceArticle,
  | "id"
  | "slug"
  | "title"
  | "excerpt"
  | "article_type"
  | "published_at"
  | "reading_time_minutes"
  | "author_name"
  | "featured_image_path"
>;

export type ResourceCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
};

export type ResourceCategoryLink = {
  article_id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
};

export class ResourceDataError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ResourceDataError";
    if (cause) this.cause = cause;
  }
}

const CARD_SELECT =
  "id,slug,title,excerpt,article_type,published_at,reading_time_minutes,author_name,featured_image_path";
const ARTICLE_SELECT =
  "id,slug,title,excerpt,content_markdown,article_type,canonical_url,featured_image_path,reading_time_minutes,published_at,last_reviewed_at,author_name,author_bio,author_avatar_path";

function assertNoError<T>(data: T | null, error: unknown, message: string): T {
  if (error) {
    console.error(`[resources] ${message}`, error);
    throw new ResourceDataError(message, error);
  }
  return data as T;
}

export async function getResourceHome() {
  const supabase = createClient();
  const [{ data: articles, error: articlesError }, { data: categories, error: categoriesError }] =
    await Promise.all([
      supabase
        .from("resource_public_articles")
        .select(CARD_SELECT)
        .order("published_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(50),
      supabase
        .from("resource_public_categories")
        .select("id,slug,name,description,display_order")
        .order("display_order", { ascending: true })
        .order("slug", { ascending: true })
        .limit(30),
    ]);

  return {
    articles: assertNoError((articles ?? []) as ResourceArticleCard[], articlesError, "Unable to load public resources"),
    categories: assertNoError((categories ?? []) as ResourceCategory[], categoriesError, "Unable to load resource categories"),
  };
}

export async function getResourceCategory(slug: string) {
  const supabase = createClient();
  const { data: category, error: categoryError } = await supabase
    .from("resource_public_categories")
    .select("id,slug,name,description,display_order")
    .eq("slug", slug)
    .maybeSingle();

  if (categoryError) {
    console.error("[resources] Unable to load resource category", categoryError);
    throw new ResourceDataError("Unable to load this resource category", categoryError);
  }
  if (!category) return null;

  const { data: links, error: linksError } = await supabase
    .from("resource_public_article_categories")
    .select("article_id")
    .eq("slug", slug)
    .limit(100);
  const safeLinks = assertNoError(links ?? [], linksError, "Unable to load category articles");
  const ids = [...new Set(safeLinks.map((row) => row.article_id as string))];

  if (ids.length === 0) {
    return { category: category as ResourceCategory, articles: [] as ResourceArticleCard[] };
  }

  const { data: articles, error: articlesError } = await supabase
    .from("resource_public_articles")
    .select(CARD_SELECT)
    .in("id", ids)
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(100);

  return {
    category: category as ResourceCategory,
    articles: assertNoError((articles ?? []) as ResourceArticleCard[], articlesError, "Unable to load category articles"),
  };
}

export async function getResourceArticle(slug: string) {
  const supabase = createClient();
  const { data: article, error: articleError } = await supabase
    .from("resource_public_articles")
    .select(ARTICLE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (articleError) {
    console.error("[resources] Unable to load resource article", articleError);
    throw new ResourceDataError("Unable to load this resource", articleError);
  }
  if (!article) return null;

  const { data: categories, error: categoriesError } = await supabase
    .from("resource_public_article_categories")
    .select("article_id,category_id,slug,name,description,display_order")
    .eq("article_id", article.id)
    .order("display_order", { ascending: true })
    .order("slug", { ascending: true })
    .limit(20);
  const categoryLinks = assertNoError(
    (categories ?? []) as ResourceCategoryLink[],
    categoriesError,
    "Unable to load article categories",
  );

  const categorySlugs = [...new Set(categoryLinks.map((category) => category.slug))];
  let related: ResourceArticleCard[] = [];
  if (categorySlugs.length > 0) {
    const { data: relatedLinks, error: relatedLinksError } = await supabase
      .from("resource_public_article_categories")
      .select("article_id")
      .in("slug", categorySlugs)
      .neq("article_id", article.id)
      .limit(30);
    const safeRelatedLinks = assertNoError(relatedLinks ?? [], relatedLinksError, "Unable to load related resources");
    const relatedIds = [...new Set(safeRelatedLinks.map((row) => row.article_id as string))].slice(0, 6);
    if (relatedIds.length > 0) {
      const { data: relatedArticles, error: relatedArticlesError } = await supabase
        .from("resource_public_articles")
        .select(CARD_SELECT)
        .in("id", relatedIds)
        .order("published_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(3);
      related = assertNoError(
        (relatedArticles ?? []) as ResourceArticleCard[],
        relatedArticlesError,
        "Unable to load related resources",
      );
    }
  }

  return { article: article as ResourceArticle, categories: categoryLinks, related };
}

export function getResourceImageUrl(path: string | null | undefined): string | null {
  if (!isApprovedResourceImagePath(path)) return null;
  const supabase = createClient();
  return supabase.storage.from("site").getPublicUrl(path).data.publicUrl || null;
}

export function isApprovedResourceImagePath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith(RESOURCE_IMAGE_PREFIX) && !path.includes("..") && !path.includes("\\") && !path.includes("//"));
}

export function getResourceCanonicalUrl(path: string, storedCanonical: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.scholars.com.ng";
  const siteUrl = new URL(base);
  if (storedCanonical) {
    try {
      const candidate = new URL(storedCanonical);
      if (candidate.protocol === "https:" && candidate.hostname === siteUrl.hostname) return candidate.toString();
    } catch {
      // Fall through to the Scholars-owned route when stored data is malformed.
    }
  }
  return `${base.replace(/\/$/, "")}/resources/${path}`;
}
