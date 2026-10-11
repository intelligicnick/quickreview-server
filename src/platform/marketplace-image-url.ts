export function normalizeMarketplaceImagePath(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function resolveMarketplaceImageUrl(
  url: string | null | undefined,
  appUrl: string | null | undefined,
): string | null {
  const path = normalizeMarketplaceImagePath(url);
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = appUrl?.replace(/\/$/, '') ?? '';
  return base ? `${base}${path}` : path;
}
