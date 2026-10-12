export function normalizeMarketplaceImagePath(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Catalog images are static files on the SPA origin — keep paths relative for the browser. */
export function resolveMarketplaceImageUrl(
  url: string | null | undefined,
  _appUrl?: string | null,
): string | null {
  const path = normalizeMarketplaceImagePath(url);
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    try {
      const { pathname } = new URL(path);
      if (pathname.startsWith('/marketplace/')) return pathname;
    } catch {
      /* keep external absolute URL */
    }
    return path;
  }
  return path;
}
