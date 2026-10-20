const CACHE_PREFIX = "scholars:offline-catalog:v1:";
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type CachedScholarshipCatalog<T> = {
  scholarships: T[];
  total: number;
  cachedAt: string;
};

export function readCachedScholarshipCatalog<T>(userId: string): CachedScholarshipCatalog<T> | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedScholarshipCatalog<T>;
    const cachedAt = new Date(parsed.cachedAt).getTime();
    if (!Array.isArray(parsed.scholarships) || !Number.isFinite(cachedAt) || Date.now() - cachedAt > MAX_CACHE_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedScholarshipCatalog<T>(userId: string, scholarships: T[], total: number): boolean {
  if (typeof window === "undefined" || !userId || !Array.isArray(scholarships)) return false;
  try {
    const payload: CachedScholarshipCatalog<T> = {
      scholarships,
      total,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(payload));
    return true;
  } catch {
    // Private browsing, quota, or storage-policy failures should not break discovery.
    return false;
  }
}
