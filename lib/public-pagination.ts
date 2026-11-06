export const PUBLIC_PAGE_SIZE = 24;

export function parsePublicPage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function pageStart(page: number): number {
  return (page - 1) * PUBLIC_PAGE_SIZE;
}

export function pageHref(path: string, page: number): string {
  return page > 1 ? `${path}?page=${page}` : path;
}
